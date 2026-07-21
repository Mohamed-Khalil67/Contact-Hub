# ContactHub — Smart Contact Manager

A contact manager built with vanilla JavaScript, Bootstrap 5 and SweetAlert2.
Contacts are stored in the browser's `localStorage`, so they survive a reload.

**Features:** add / edit / delete contacts, search by name, phone or email,
mark contacts as favourite or emergency, call and email action buttons,
photo upload, and live form validation.

---

## Project structure

```
Assignment10/
├── index.html                  the whole page (markup only, no logic)
├── favicon.svg
├── css/
│   ├── bootstrap.min.css       Bootstrap 5
│   ├── all.min.css             Font Awesome 6.4.0
│   └── style.css               custom styling + @font-face for Inter
├── js/
│   ├── bootstrap.bundle.min.js Bootstrap's JS (gives us `bootstrap.Modal`)
│   ├── sweetalert2.min.js      SweetAlert2 (gives us `Swal`)
│   └── main.js                 all application logic
├── fonts/                      Inter (self hosted)
├── webfonts/                   Font Awesome icon fonts
└── images/profile.jpg
```

Everything is local — the project runs with **no internet connection**.

### Libraries

| Library | Global it creates | What it is used for |
|---|---|---|
| Bootstrap 5 | `bootstrap` | the modal shell, grid, buttons, form validation classes |
| SweetAlert2 | `Swal` | error alerts, success toasts, delete confirmation |
| Font Awesome | — | icons (CSS only, no JavaScript) |

All CRUD logic is plain JavaScript — no jQuery, no framework.

---

## How the JavaScript reaches the HTML

Four mechanisms are used throughout `main.js`:

**1. Lookup by `id`**

```js
const rowData = document.getElementById('rowData');   // <div id="rowData">
```

**2. Implicit globals** — any element with an `id` is automatically a global
variable, which is why the form fields are read with no lookup:

```js
name: fullName.value.trim(),      // works because of <input id="fullName">
```

**3. Inline `onclick` inside generated HTML** — the card buttons are built as
strings, so they call functions by name:

```js
onclick="toggleFavorite(${i})"    // renders as onclick="toggleFavorite(3)"
```

This is why `toggleFavorite`, `toggleEmergency`, `editContact` and
`deleteContact` look unused inside `main.js` — their only callers are in HTML
that JavaScript itself produced.

**4. Bootstrap data attributes** — no JavaScript at all:

```html
<button data-bs-toggle="modal" data-bs-target="#addContactModal">
<button data-bs-dismiss="modal">
```

---

## The data

```js
let contacts = JSON.parse(localStorage.getItem('contacts')) || [];
```

`localStorage` only stores strings, so contacts are saved with
`JSON.stringify` and read back with `JSON.parse`. `getItem` returns `null` on a
first visit, so `|| []` starts an empty list rather than crashing.

Each contact is a plain object:

```js
{
  name, phone, email, address, group, notes,
  favorite,   // boolean - shows in the Favorites panel
  emergency,  // boolean - shows in the Emergency panel
  photo,      // base64 string, or '' for initials instead
  color       // avatar background, e.g. 'var(--red)'
}
```

Two other module level variables hold UI state:

- `editIndex` — which contact is being edited, or `null` when adding
- `photo` — the photo currently shown in the modal preview

---

## Functions

### Rendering

#### `display()`
The centre of the app. Every change ends up here.

1. Reads the search box
2. Loops `contacts` and skips any that do not match the term
3. Builds the card HTML and writes it into `#rowData`
4. Falls back to the "No contacts found" empty state if nothing matched
5. Calls `displaySidebar()` and `updateStats()`

It loops over `contacts` directly rather than a filtered copy, so the loop
counter `i` is already the real index — that is what the card's `onclick`
handlers need. Filtering into a separate array first would mean looking the
index up again with `indexOf`.

Because `display()` reads the search box itself, the list stays filtered after
an add, edit, delete or favourite toggle.

**Touches:** `#rowData`, `#searchInput`

#### `sidebarCard(contact, btnClass)`
Builds one row for a sidebar panel. `btnClass` is `'favorites-call'` (green) or
`'emergency-call'` (red), so one function serves both panels.

#### `displaySidebar()`
Filters for favourites and emergencies, renders them with `sidebarCard`, or
shows an empty message.

**Touches:** `#favoritesList`, `#emergencyList`

#### `updateStats()`
Updates the four counters.

**Touches:** `#totalContacts`, `#favoritesCount`, `#emergencyCount`,
`#contactsCount`

#### `initials(name)`
`"Ahmed Hassan"` → `"AH"`. Used for the avatar when a contact has no photo.

---

### Validation

#### `validateInput(input)`
Runs on every keystroke. Adds Bootstrap's `.is-valid` or `.is-invalid` to the
field, or neither while it is empty so untouched fields stay neutral.

Bootstrap's CSS does the rest: `.is-invalid` automatically reveals the sibling
`<div class="invalid-feedback">`.

The field is found with `rules[input.id]` — a direct lookup, not a loop. It
works because the HTML `id` values match the keys of `rules` exactly.

#### The `for...in` loop over `rules`
Runs **once** at page load and attaches an `input` listener to each of the three
validated fields. This is what causes `validateInput` to fire.

#### `getFormError()`
Checks the whole form in order and returns `[title, message]` for the first
problem found, or `null` when everything is valid. Order matters: a missing name
is reported before an invalid one, and a duplicate phone before a bad email.

Also blocks duplicate phone numbers, normalising `+20` / `0020` / `20` prefixes
so `+201012345678` and `01012345678` are recognised as the same number.

#### `hasError()`
Calls `getFormError()`, shows the red SweetAlert if there is a problem, and
returns `true`/`false`. The save and update handlers use it as a guard:
`if (hasError()) return;`

#### Validation rules

| Field | Rule | Accepts |
|---|---|---|
| Name | `/^[A-Z؀-ۿ][A-Za-z؀-ۿ ]{2,29}$/` | 3–30 letters, must start with a capital. Arabic passes (no letter case) |
| Phone | `/^(\+20\|0)1[0125][0-9]{8}$/` | Egyptian mobiles: 010, 011, 012, 015, with optional `+20` |
| Email | `/^[\w.%+-]+@[\w.-]+\.[a-z]{2,}$/i` | needs `@` and a domain ending — `.com`, `.eg`, `.co.uk` |

Email is optional; the rule only applies when the field is not empty.

---

### Reading and writing the form

#### `getFormData()`
Reads all eight fields into one contact object, plus the current photo and a
random colour from the palette. Used by both the save and update handlers.

#### `fillForm(contact)`
The reverse — pushes a contact's values into the form. Used by `editContact`.

#### `showPhoto(src)`
Sets the `photo` variable and rebuilds the preview: an `<img>` when there is a
photo, the user icon when there is not. The preview is a `<div>`, not an input,
so it cannot simply be assigned a `.value`.

**Touches:** `.contact-photo-preview`

#### `resetForm()`
Clears the form, the photo, `editIndex` and the validation classes, then puts
the modal back into "add" mode — title back to *Add New Contact*, Save shown,
Update hidden.

---

### CRUD

#### `save()`
Writes `contacts` to `localStorage` **and** calls `display()`. Every change goes
through it, so nothing else has to remember to redraw.

#### `toast(title, text)`
The green success popup. Closes itself after 1.5 seconds.

#### `editContact(i)`
Stores `editIndex`, fills the form, retitles the modal to *Edit Contact*, swaps
the Save button for Update, then opens the modal with `modal.show()`.

**Called from:** the pencil button's `onclick`

#### `deleteContact(i)`
Shows the SweetAlert confirmation. `Swal.fire()` returns a **Promise**, so the
contact is only removed inside `.then()` when `res.isConfirmed` is true.

**Called from:** the trash button's `onclick`

#### `toggleFavorite(i)` / `toggleEmergency(i)`
Flip the boolean and call `save()`. That single call persists the change,
re-renders the card icon, updates the sidebar and updates the counters.

**Called from:** the star and heart buttons' `onclick`

#### `seedSampleContacts()`
Adds eight demo contacts, but only when `localStorage` is empty, so it never
overwrites real data. Delete the function and its call to start with an empty
list.

---

## Event listeners

| Element | Event | Handler |
|---|---|---|
| `#saveContactBtn` | `click` | validate → `push` → `save()` → close → toast |
| `#updateContactBtn` | `click` | validate → replace `contacts[editIndex]` → `save()` → close → toast |
| `#searchInput` | `input` | `display()` |
| `#photoInput` | `change` | `FileReader` → base64 → `showPhoto()` |
| `#addContactModal` | `hidden.bs.modal` | `resetForm()` |
| the three validated fields | `input` | `validateInput()` |

Listening for `hidden.bs.modal` rather than the Cancel button matters: the modal
can be closed four ways — Cancel, the × button, the Escape key, or clicking
outside — and all four fire that event, so the form is always reset.

---

## The modal serves two purposes

There is only one modal in the HTML, used for both adding and editing:

| | Add mode | Edit mode |
|---|---|---|
| Opened by | Add Contact button (`data-bs-toggle`) | pencil icon → `modal.show()` |
| Title | Add New Contact | Edit Contact |
| Footer button | Save Contact | update Contact |
| `editIndex` | `null` | index of the contact |

`editContact()` switches into edit mode and `resetForm()` switches back.

---

## Two flows worth tracing

**Clicking the star on a card**

```
onclick="toggleFavorite(3)"
  → contacts[3].favorite = !contacts[3].favorite
  → save()
      → localStorage.setItem(...)
      → display()
          → card icon fills in
          → sidebar gains a row
          → FAVORITES counter goes up
```

**Adding a contact**

```
Add Contact (data-bs-toggle)  → Bootstrap opens the modal
typing                        → validateInput() on each keystroke
Save Contact                  → hasError()      valid?  no → red alert, stop
                              → getFormData()
                              → contacts.push()
                              → save()          persist + redraw
                              → modal.hide()
                              → toast('Added!')
modal finishes closing        → hidden.bs.modal → resetForm()
```
