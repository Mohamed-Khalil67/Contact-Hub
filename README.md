# 📇 ContactHub

A smart contact manager for friends, family and work contacts. Vanilla JavaScript, no backend: everything is saved in the browser.

[![Live Demo](https://img.shields.io/badge/Live_Demo-GitHub_Pages-222?style=for-the-badge&logo=github)](https://mohamed-khalil67.github.io/Contact-Hub/)

## Features

- Add, edit and delete contacts (name, phone, email, address, group)
- Mark contacts as **Favorites** or **Emergency**, each with its own list and counter
- Live **search** that filters the list as you type
- Saved to `localStorage`, so contacts survive a page reload; demo contacts are seeded on first visit
- SweetAlert2 confirmations for destructive actions
- Responsive layout

## Tech stack

HTML5 · CSS3 (custom styles on top of Bootstrap) · Vanilla JavaScript (ES6) · Bootstrap · Font Awesome · SweetAlert2

## What I practised

State kept in one object and rendered from it, with all `localStorage` access isolated in small functions; DOM rendering with template literals; a hand-written ~1,200-line stylesheet.

## Run locally

No build step. Clone the repo and open `index.html` in a browser (or use the VS Code Live Server extension).

```bash
git clone https://github.com/Mohamed-Khalil67/Contact-Hub.git
cd Contact-Hub
```

## Author

**Mohamed Khalil**: [GitHub](https://github.com/Mohamed-Khalil67) · [Portfolio](https://portfolio-swart-omega-11.vercel.app) · [LinkedIn](https://www.linkedin.com/in/mohamed-khalil-ucbl/)
