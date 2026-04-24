from __future__ import annotations

import json
import re
import sys
import unicodedata
from io import BytesIO
from pathlib import Path
from zipfile import ZipFile

from pypdf import PdfReader


ROOT_PREFIX = "Question Bank (Unformatted)/"
FORMATTED_ANSWERS_PREFIX = "Question Bank (Formatted)/Answers/"
ZIP_PATH = Path(r"C:\Users\dulat\Downloads\SAT Question Bank PDFs.zip")
OUT_PATH = Path(r"C:\Users\dulat\Downloads\project\public\data\sat-question-bank.json")


def normalize_text(value: str) -> str:
    value = unicodedata.normalize("NFKC", value or "")
    return value.replace("\u00a0", " ").replace("\ufb03", "ffi").replace("\ufb01", "fi")


def extract_pdf_text(data: bytes) -> str:
    reader = PdfReader(BytesIO(data))
    parts = []
    for page in reader.pages:
        parts.append(page.extract_text() or "")
    return normalize_text("\n".join(parts))


def extract_pdf_page_texts(data: bytes) -> list[str]:
    reader = PdfReader(BytesIO(data))
    return [normalize_text(page.extract_text() or "") for page in reader.pages]


def clean_lines(text: str) -> list[str]:
    lines = [re.sub(r"\s+", " ", line).strip() for line in text.splitlines()]
    return [line for line in lines if line]


def parse_choice_lines(body: str) -> tuple[str, list[str]]:
    lines = clean_lines(body)
    first_choice = None
    for index, line in enumerate(lines):
        if re.match(r"^[A-D]\.\s*", line):
            first_choice = index
            break

    if first_choice is None:
        return "\n".join(lines).strip(), []

    question_lines = lines[:first_choice]
    choices: list[str] = []
    current_label = None
    current_parts: list[str] = []

    for line in lines[first_choice:]:
        match = re.match(r"^([A-D])\.\s*(.*)$", line)
        if match:
            if current_label:
                choices.append(" ".join(current_parts).strip())
            current_label = match.group(1)
            current_parts = [match.group(2).strip()]
            continue

        if current_label:
            current_parts.append(line)

    if current_label:
        choices.append(" ".join(current_parts).strip())

    return "\n".join(question_lines).strip(), choices


def parse_question_pdf(text: str) -> list[dict]:
    chunks = re.split(r"(?=Question ID\s+[0-9a-f]{8})", text)
    questions = []

    for chunk in chunks:
        id_match = re.search(r"Question ID\s+([0-9a-f]{8})", chunk)
        if not id_match:
            continue

        question_id = id_match.group(1)
        body_match = re.search(
            rf"ID:\s*{re.escape(question_id)}\s*(.*?)(?:Assessment\s+SAT\s+Test|Question ID\s+[0-9a-f]{{8}}|$)",
            chunk,
            flags=re.S,
        )
        if not body_match:
            continue

        body = body_match.group(1).strip()
        question_text, choices = parse_choice_lines(body)
        if not question_text and not any(choices):
            continue

        questions.append(
            {
                "sourceId": question_id,
                "questionText": question_text,
                "choices": choices,
            }
        )

    return questions


def parse_question_pdf_pages(data: bytes) -> list[dict]:
    questions = []
    for page_number, page_text in enumerate(extract_pdf_page_texts(data), start=1):
        for question in parse_question_pdf(page_text):
            question["sourcePage"] = page_number
            questions.append(question)
    return questions


def parse_answer_key_pdf(text: str) -> dict[str, dict]:
    answers: dict[str, dict] = {}
    chunks = re.split(r"(?=Question ID\s+[0-9a-f]{8})", text)

    for chunk in chunks:
        id_match = re.search(r"Question ID\s+([0-9a-f]{8})", chunk)
        if not id_match:
            continue

        question_id = id_match.group(1)
        answer_match = re.search(
            rf"ID:\s*{re.escape(question_id)}\s+Answer\s+Correct Answer:\s*(.*?)\s+Rationale\s+(.*?)(?:Question Difficulty:|Assessment\s+SAT\s+Test|Question ID\s+[0-9a-f]{{8}}|$)",
            chunk,
            flags=re.S,
        )
        if not answer_match:
            continue

        correct_answer = re.sub(r"\s+", " ", answer_match.group(1)).strip()
        rationale = re.sub(r"\s+", " ", answer_match.group(2)).strip()
        difficulty_match = re.search(r"Question Difficulty:\s*([A-Za-z]+)", chunk)
        answers[question_id] = {
            "correctAnswer": correct_answer,
            "rationale": rationale,
            "difficulty": difficulty_match.group(1) if difficulty_match else "",
        }

    return answers


def parse_formatted_answer_table(text: str) -> dict[str, dict]:
    answers: dict[str, dict] = {}
    for line in clean_lines(text):
        match = re.match(r"^\d+\.\d+\s*([0-9a-f]{8})\s+(.+)$", line)
        if not match:
            continue

        answer = match.group(2).strip()
        if not answer or answer.lower() == "answer":
            continue

        answers[match.group(1)] = {
            "correctAnswer": answer,
            "rationale": "",
            "difficulty": "",
        }

    return answers


def question_entry_meta(full_name: str) -> dict | None:
    if not full_name.startswith(ROOT_PREFIX) or not full_name.lower().endswith(".pdf"):
        return None
    if "/Answer Keys/" in full_name:
        return None

    parts = full_name.removeprefix(ROOT_PREFIX).split("/")
    if len(parts) < 3:
        return None

    test = parts[0]
    if test not in {"Math", "Reading and Writing"}:
        return None

    file_name = parts[-1]
    set_match = re.search(r"(\d+)\.pdf$", file_name, flags=re.I)
    set_number = int(set_match.group(1)) if set_match else 1
    topic = re.sub(r"\s+\d+\.pdf$", "", file_name, flags=re.I)

    return {
        "subject": "math" if test == "Math" else "rw",
        "sectionLabel": "Math" if test == "Math" else "English",
        "domain": parts[1] if len(parts) > 2 else test,
        "subsection": parts[-2] if len(parts) > 3 else topic,
        "topic": topic,
        "set": set_number,
        "sourcePdf": full_name,
    }


def is_answer_key(full_name: str) -> bool:
    return (
        full_name.startswith(ROOT_PREFIX + "Answer Keys/")
        and full_name.lower().endswith(".pdf")
        and "Answer Key" in full_name
    )


def is_formatted_answer_key(full_name: str) -> bool:
    return (
        full_name.startswith(FORMATTED_ANSWERS_PREFIX)
        and full_name.lower().endswith(".pdf")
        and "~Key" in full_name
    )


def sort_key(name: str) -> tuple:
    normalized = name.replace("\\", "/")
    return tuple(re.split(r"(\d+)", normalized))


def main() -> int:
    if not ZIP_PATH.exists():
        print(f"Missing ZIP: {ZIP_PATH}", file=sys.stderr)
        return 1

    with ZipFile(ZIP_PATH) as archive:
        answer_entries = sorted((entry for entry in archive.infolist() if is_answer_key(entry.filename)), key=lambda e: sort_key(e.filename))
        formatted_answer_entries = sorted((entry for entry in archive.infolist() if is_formatted_answer_key(entry.filename)), key=lambda e: sort_key(e.filename))
        question_entries = sorted((entry for entry in archive.infolist() if question_entry_meta(entry.filename)), key=lambda e: sort_key(e.filename))

        answers: dict[str, dict] = {}
        for entry in answer_entries:
            text = extract_pdf_text(archive.read(entry))
            answers.update(parse_answer_key_pdf(text))

        for entry in formatted_answer_entries:
            text = extract_pdf_text(archive.read(entry))
            for question_id, answer in parse_formatted_answer_table(text).items():
                if question_id not in answers or not answers[question_id].get("correctAnswer"):
                    answers[question_id] = answer

        questions: list[dict] = []
        seen_ids: set[str] = set()
        for entry in question_entries:
            meta = question_entry_meta(entry.filename)
            if not meta:
                continue

            pdf_data = archive.read(entry)
            parsed = parse_question_pdf_pages(pdf_data)
            for local_index, question in enumerate(parsed, start=1):
                source_id = question["sourceId"]
                if source_id in seen_ids:
                    continue
                seen_ids.add(source_id)
                answer = answers.get(source_id, {})
                questions.append(
                    {
                        "id": f"{meta['subject']}:{source_id}",
                        "sourceId": source_id,
                        "subject": meta["subject"],
                        "sectionLabel": meta["sectionLabel"],
                        "domain": meta["domain"],
                        "subsection": meta["subsection"],
                        "topic": meta["topic"],
                        "set": meta["set"],
                        "number": local_index,
                        "sourcePdf": meta["sourcePdf"],
                        "sourcePage": question.get("sourcePage", 1),
                        "questionText": question["questionText"],
                        "choices": question["choices"],
                        "correctAnswer": answer.get("correctAnswer", ""),
                        "rationale": answer.get("rationale", ""),
                        "difficulty": answer.get("difficulty", ""),
                    }
                )

    payload = {
        "version": 1,
        "source": str(ZIP_PATH),
        "counts": {
            "total": len(questions),
            "rw": sum(1 for question in questions if question["subject"] == "rw"),
            "math": sum(1 for question in questions if question["subject"] == "math"),
            "withAnswers": sum(1 for question in questions if question["correctAnswer"]),
        },
        "questions": questions,
    }

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(json.dumps(payload["counts"], ensure_ascii=False, indent=2))
    print(f"Wrote {OUT_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
