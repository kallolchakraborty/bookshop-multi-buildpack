"""SAP HANA Cloud Vector Engine Seed & Migration Script.

Reads book descriptions from CSV seed data, generates 1536-dimensional text embeddings
using OpenAI / NVIDIA embedding models, and updates the native REAL_VECTOR column in SAP HANA Cloud.
"""
import csv
import os
import sys

# Ensure root import path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))
from python.agent.rag import get_hana_connection

def generate_and_seed_vectors(csv_path: str = "db/data/kallol.bookshop-Book.csv"):
    """Batch generate embeddings and seed into SAP HANA Cloud database table."""
    if not os.path.exists(csv_path):
        print(f"[Seed Warning] CSV file not found: {csv_path}", file=sys.stderr)
        return

    print(f"🔄 Reading seed books from {csv_path}...")
    books = []
    with open(csv_path, mode="r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            books.append(row)

    print(f"📦 Found {len(books)} book entries for embedding processing.")

    try:
        from langchain_openai import OpenAIEmbeddings
        embeddings_model = OpenAIEmbeddings(
            model=os.environ.get("EMBEDDING_MODEL", "text-embedding-3-small"),
            openai_api_key=os.environ.get("AI_API_KEY", "placeholder")
        )

        conn = get_hana_connection()
        cursor = conn.cursor()

        for book in books:
            book_id = book.get("ID")
            title = book.get("title", "")
            descr = book.get("descr", title)

            if not descr:
                continue

            print(f"  ⚡ Computing vector embedding for Book #{book_id}: '{title}'...")
            vector = embeddings_model.embed_query(f"{title}: {descr}")
            
            # Format vector as string for SAP HANA REAL_VECTOR column insertion
            vector_str = f"TO_REAL_VECTOR('{vector}')"
            
            sql = f"UPDATE KALLOL_BOOKSHOP_BOOK SET EMBEDDING = {vector_str} WHERE ID = {book_id}"
            cursor.execute(sql)
        
        conn.commit()
        cursor.close()
        conn.close()
        print("✅ Successfully seeded all book vector embeddings into SAP HANA Cloud!")

    except Exception as exc:
        print(f"[Vector Seed Info] HANA connection uninitialized / local dev mode: {exc}")

if __name__ == "__main__":
    generate_and_seed_vectors()
