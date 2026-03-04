import requests
from config import GROK_API_KEY

GROK_URL = "https://api.x.ai/v1/chat/completions"


def call_grok(prompt: str):

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {GROK_API_KEY}"
    }

    payload = {
        "model": "grok-4-latest",
        "messages": [
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": prompt}
        ],
        "temperature": 0,
        "stream": False
    }

    response = requests.post(GROK_URL, headers=headers, json=payload)

    if response.status_code != 200:
        return f"Error: {response.text}"

    return response.json()["choices"][0]["message"]["content"]