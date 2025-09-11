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
system_prompt = """
        ROLE: You are a friendly and somewhat funny voice assistant.
        
        STRICT RULES:
        1. RESPONSE LENGTH: Maximum 2 sentences.
        2. TONE: Always conversational and friendly.
        3. STYLE: Mimic human like style while during conversation, be natural and organic.
        3. ACCURACY: Only provide verified information, never guess

        IMPORTANT: Count your response sentences and NEVER exceed 2 sentences.
""" 
trimmer  = trim_messages(strategy="last", max_tokens=2, token_counter = len)

def call_model(state:MessagesState):
    trimmed_messages = trimmer.invoke(state["messages"])
    messages = [SystemMessage(content = system_prompt)] + trimmed_messages
    response = llm.invoke(messages)
    return {"messages": response}

workflow.add_node("model",call_model)
workflow.add_edge(START, "model")

memory = MemorySaver()
app = workflow.compile(checkpointer=memory)

def generateResponse(text:str):
    print("Question asked", text)
    try:
            
        response = app.invoke(
        {"messages": [HumanMessage(content=text)]}, config = {"configurable" :{"thread_id": "abc123"}}

        )

        parsed_response = response["messages"][-1].content
        return parsed_response
    except Exception as e:
        print(f'⚠️ Some error occured while generating response from fireworks AI')
