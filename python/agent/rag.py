"""RAG module using SAP HANA Cloud Vector Engine (BTP Trial compatible)."""
import json
import os

def get_hana_connection():
    """Establish direct connection to SAP HANA Cloud HDI container."""
    vcap = os.environ.get("VCAP_SERVICES")
    if not vcap:
        # Fallback to env vars for local dev
        from hdbcli import dbapi
        return dbapi.connect(
            address=os.environ.get("HANA_HOST", "localhost"),
            port=int(os.environ.get("HANA_PORT", "30015")),
            user=os.environ.get("HANA_USER", "SYSTEM"),
            password=os.environ.get("HANA_PASSWORD", "")
        )
    
    # Extract from SAP BTP Cloud Foundry VCAP_SERVICES binding
    vcap_json = json.loads(vcap)
    hana_creds = vcap_json["hana"][0]["credentials"]
    from hdbcli import dbapi
    return dbapi.connect(
        address=hana_creds["host"],
        port=int(hana_creds["port"]),
        user=hana_creds["user"],
        password=hana_creds["password"],
        sslValidateCertificate=False
    )

def get_rag_context(query: str, k: int = 3) -> str:
    """Perform cosine similarity search against SAP HANA Cloud Vector Engine."""
    try:
        from langchain_community.vectorstores.hanavector import HanaDB
        from langchain_openai import OpenAIEmbeddings

        connection = get_hana_connection()
        embeddings = OpenAIEmbeddings(
            model=os.environ.get("EMBEDDING_MODEL", "text-embedding-3-small"),
            openai_api_key=os.environ.get("AI_API_KEY", "placeholder")
        )
        
        db = HanaDB(
            connection=connection,
            embedding=embeddings,
            table_name="KALLOL_BOOKSHOP_BOOK"
        )
        
        docs = db.similarity_search(query, k=k)
        return "\n---\n".join([d.page_content for d in docs])
    except Exception as exc:
        print(f"[RAG Info] HANA Vector Search uninitialized / local mode: {exc}")
        return "Catalog Context: Default SAP BTP Bookshop inventory (Bestseller, Classic, Fantasy titles)."
