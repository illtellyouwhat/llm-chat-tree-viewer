# LLM Chat Tree Viewer

AI web chat interfaces allow you to edit conversation turns, resulting in complex conversation trees. It's sometimes hard to find things in long chats with lots of branches. This Extension shows you a hierarchical map of the whole conversation; lets you mark conversation turns in various ways; and lets you add your own notes to conversation turns, so that you can remember what they contain, or why they're important. 

## To use extension

* save the folder to a stable location (the browser loads it from this location every time)
* open chrome://extensions
* Developer Mode ON
* Load unpacked, or 
* drag and drop the folder 

## Data storage

Xtn stores annotations in chrome local storage (chrome.storage.local, keyed as cttv-ann-{conversationId} — one entry per conversation), meaning that the data is tied to the xtn. Delete the xtn and the data is gone. But you can now export it to json first, and import it later/elsewhere.

## Roadmap

* support other model chats like claude, deepseek

