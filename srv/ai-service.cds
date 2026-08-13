// Enterprise AI Service exposed at path "/ai".
// Delegates prompts, SAP HANA Cloud Vector RAG queries, and LangGraph agent requests
// to the persistent co-located Python worker.
service AIService @(path : '/ai') {

  // Single-turn prompt completion action (direct LLM call via Python worker).
  action ask(
    prompt : String, // User query prompt
    model  : String  // Optional LLM model identifier override
  ) returns {
    answer  : String;  // LLM generated answer
    model   : String;  // Model identifier used for generation
    latency : Integer; // Execution latency in milliseconds
  };

  // RAG action: Performs SAP HANA Cloud REAL_VECTOR search and retrieves catalog context before LLM call.
  action ask_rag(
    prompt : String, // User catalog query prompt
    model  : String  // Optional model identifier override
  ) returns {
    answer  : String;  // Context-augmented assistant reply
    model   : String;  // Model used
    latency : Integer; // Execution latency in milliseconds
  };

  // Stateful LangGraph Agent workflow action:
  // Executes intent classification, conditional RAG, promo rate calculation, and guardrail verification.
  action ask_agent(
    prompt : String, // User query prompt for agent workflow
    model  : String  // Optional model identifier override
  ) returns {
    answer           : String;  // Final verified assistant answer
    model            : String;  // Model used
    latency          : Integer; // Execution latency in milliseconds
    intent           : String;  // Intent detected (discount_query, recommendation, general)
    discount_applied : Decimal(4, 2); // Calculated discount rate (e.g., 0.20)
  };
}