---
name: Guest checkout flow
url: https://demo.playwright.dev/todomvc
viewport:
  width: 1280
  height: 720
timeout: 30000
---

# Setup

A TodoMVC application. The page loads with an empty todo list and an input field to add items.

# Steps

1. Navigate to the app and verify the input field is visible
2. Add a new todo item called "Buy groceries"
3. Add a second todo item called "Clean the house"
4. Mark "Buy groceries" as completed
5. Filter to show only active items and confirm only "Clean the house" is visible
6. Filter to show all items and confirm both todos appear with correct completion states
