"""LangGraph StateGraph definition for the Bookshop AI Agent.

Assembles the full multi-step agent workflow:
input_guardrail -> route_intent -> hana_vector_rag -> apply_discount -> call_llm -> output_guardrail -> format_output
"""
from typing import TypedDict, List, Any
from python.agent.nodes import (
    input_guardrail_node,
    route_intent,
    hana_vector_rag_node,
    apply_discount_node,
    call_llm_node,
    output_guardrail_node,
    format_output_node,
)

class BookshopAgentState(TypedDict):
    # Input
    user_prompt: str
    model: str
    base_url: str
    api_key: str
    streaming: bool
    chat_history: List[Any]
    catalog_context: str
    # Security & Guardrails
    blocked: bool
    # Intermediate
    intent: str
    discount_rate: float
    # Output
    llm_response: str
    final_answer: str
    applied_discount: float
    intent_detected: str

def build_bookshop_graph():
    """Build and compile the LangGraph agent state machine graph."""
    try:
        from langgraph.graph import StateGraph, END
        g = StateGraph(BookshopAgentState)
        
        # Register Graph Nodes
        g.add_node("input_guardrail",   input_guardrail_node)
        g.add_node("route_intent",      route_intent)
        g.add_node("hana_vector_rag",   hana_vector_rag_node)
        g.add_node("apply_discount",    apply_discount_node)
        g.add_node("call_llm",          call_llm_node)
        g.add_node("output_guardrail",  output_guardrail_node)
        g.add_node("format_output",     format_output_node)
        
        # Connect Edges sequentially
        g.set_entry_point("input_guardrail")
        g.add_edge("input_guardrail",   "route_intent")
        g.add_edge("route_intent",      "hana_vector_rag")
        g.add_edge("hana_vector_rag",   "apply_discount")
        g.add_edge("apply_discount",    "call_llm")
        g.add_edge("call_llm",          "output_guardrail")
        g.add_edge("output_guardrail",  "format_output")
        g.add_edge("format_output",     END)
        
        return g.compile()
    except ImportError:
        # Fallback if langgraph is not yet installed in local python environment
        return None

bookshop_graph = build_bookshop_graph()
