import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

// Initialize Gemini with your API key
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  throw new Error("GEMINI_API_KEY is not defined in environment variables");
}

const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

export async function POST(request: Request) {
  try {
    // Parse the incoming message from the request body
    const { message } = await request.json();
    console.log('Received message:', message); // Log the received message

    // Check if the message exists
    if (!message) {
      return NextResponse.json({ error: 'Message content is required' }, { status: 400 });
    }

    console.log('Sending request to Gemini API with message:', message);

    // Send the message to the Gemini API
    const result = await model.generateContent(message);

    // Log the response to verify it
    console.log("Gemini API response:", result.response.text());

    // Send back the AI's response
    return NextResponse.json({ response: result.response.text() });
    
  } catch (error) {
    console.error("Error processing request:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
