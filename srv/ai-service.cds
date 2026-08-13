// AI service exposed at /ai. Delegates to an OpenAI-compatible AI API reached
// through the BTP destination "meta-llama-3-3-70b-instruct" in production.
service AIService @(path : '/ai') {
  // Sends a prompt to the configured AI API and returns the assistant answer.
  // Defaults to model "meta/llama-3.3-70b-instruct" (see handler / AI_MODEL env).
  action ask(
    prompt : String, // the user prompt to send to the AI model
    model  : String  // optional model id; overrides AI_MODEL if provided
  ) returns {
    answer  : String;  // assistant reply text
    model   : String;  // model that generated the reply
    latency : Integer; // round-trip time in milliseconds
  };
}