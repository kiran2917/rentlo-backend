from gtts import gTTS
import os

text = "Message for Mohith"
language = 'en'
speech = gTTS(text=text, lang=language, slow=False)
speech.save("c:/Users/karti/Desktop/mohith/PropertyHub/frontend/public/notification.mp3")
speech.save("c:/Users/karti/Desktop/mohith/PropertyHub/scratch_frontend/public/notification.mp3")
print("MP3 generated successfully.")
