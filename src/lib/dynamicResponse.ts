import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
});

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function mockDynamicAIQuery(
  docId: string,
  question: string,
): Promise<string> {
  await delay(200);

  try {
    // ⚠️ Replace this with real document fetch
    const documentText = `Document ID: ${docId}. 
    This is the extracted text from the uploaded document.
    Replace this with real document content from database or storage.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are an AI assistant that answers questions based on a provided document.",
        },
        {
          role: "user",
          content: `
Document Content:
${documentText}

User Question:
${question}

Answer clearly based on the document.
`,
        },
      ],
      temperature: 0.3,
    });

    return (
      response.choices[0]?.message?.content ||
      "No response generated."
    );
  } catch (error) {
    console.error("AI error:", error);

    return `Sorry, I couldn't process the question: "${question}".`;
  }
}