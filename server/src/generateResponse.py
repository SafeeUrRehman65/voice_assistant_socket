import os
from langchain_fireworks import ChatFireworks
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from dotenv import load_dotenv
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import START, MessagesState, StateGraph
from langchain_core.messages import trim_messages

load_dotenv()


workflow = StateGraph(state_schema = MessagesState)

llm = ChatFireworks(
    model="accounts/fireworks/models/kimi-k2-instruct",
    temperature = 0.2,
    api_key=os.getenv("FIREWORKS_API_KEY"),
    max_tokens = None,
    )

# Make instructions more explicit and actionable
prompt = ChatPromptTemplate.from_messages([
    (
        "system", 
        """ROLE: You are a friendly voice assistant.
        
        STRICT RULES:
        1. RESPONSE LENGTH: Maximum 2-3 sentences OR 200 characters
        2. TONE: Always conversational and friendly
        3. ACCURACY: Only provide verified information, never guess

        IMPORTANT: Count your response characters and NEVER exceed 200 characters."""
            ),
            ("human", "{input}")
    ])

trimmer  = trim_messages(strategy="last", max_tokens=2, token_counter = len)

def call_model(state:MessagesState):
    trimmed_messages = trimmer.invoke(state["messages"])
    system_prompt =("""
        **RULES**
        - Always respond in a friendly and conversational tone.
        - Provide brief and short responses to keep conversation engaging, unless necessarily needed.
        - DO NOT hallucinate, only provide authentic and genuine information
        """)
    messages = [SystemMessage(content = system_prompt)] + trimmed_messages
    response = llm.invoke(messages)
    return {"messages": response}

workflow.add_node("model",call_model)
workflow.add_edge(START, "model")

memory = MemorySaver()
app = workflow.compile(checkpointer=memory)

def generateResponse(text:str):
    print("Question asked", text)
    response = app.invoke(
    {"messages": [HumanMessage(content=text)]}, config = {"configurable" :{"thread_id": "abc123"}}

    )
    parsed_response = response["messages"][-1].content
    return parsed_response
