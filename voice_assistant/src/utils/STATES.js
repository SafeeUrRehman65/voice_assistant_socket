// define all possible states
export const STATES = {
  LISTENING: "listening",
  PROCESSING: "processing",
  SPEAKING: "speaking",
  SILENT: "silent",
};


export const prompts_responses = [
  {
    prompt: "Hello",
    response: "Hi there!",
  },
  {
    prompt: "What's the weather like today?",
    response:
      "The weather today is sunny with a high of 25°C and a light breeze from the north.",
  },
  {
    prompt: "Tell me a joke.",
    response:
      "Why did the scarecrow win an award? Because he was outstanding in his field!",
  },
  {
    prompt: "Can you summarize the plot of Inception?",
    response:
      "Inception follows a skilled thief, Dom Cobb, who steals information by infiltrating dreams. He’s given a chance to have his criminal record erased if he can plant an idea in someone’s mind—a process known as inception. The story unfolds across multiple dream layers with complex rules and intense action.",
  },
  {
    prompt: "What is the capital of France?",
    response: "Paris.",
  },
  {
    prompt: "List 5 benefits of daily meditation.",
    response:
      "1. Reduced stress\n2. Improved focus\n3. Better emotional health\n4. Enhanced self-awareness\n5. Lower blood pressure",
  },
  {
    prompt: "Explain quantum physics in simple terms.",
    response:
      "Quantum physics is the study of the smallest particles in the universe. It shows that particles can exist in multiple states at once and only settle into one when observed. It challenges our traditional ideas of how things work at very small scales.",
  },
  {
    prompt: "Short prompt",
    response: "Short response",
  },
  {
    prompt:
      "This is a very long prompt meant to test how the UI behaves when a lot of text is entered in the prompt field. It should ideally wrap correctly and remain readable across various screen sizes and devices.",
    response:
      "This response is equally long and is used to verify that long text responses don't break the layout. The UI should gracefully handle overflow, wrapping, and alignment, regardless of content length.",
  },
  {
    prompt: "😊",
    response: "👋 Hello there!",
  },
];
