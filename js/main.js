/* ============================================================================
   ContactHub

   The file is split into layers and each layer only talks to the ones above
   it, so a change stays where it belongs:

     1. Config      constants, no logic
     2. State       the only mutable data in the app
     3. Store       localStorage + the list operations
     4. Model       pure contact logic, never touches the DOM
     5. Validation  form rules, returns errors instead of showing them
     6. elements    every DOM element the app uses, looked up once
     7. Alerts      SweetAlert wrappers, the only place popups are built
     8. View        turns state into HTML
     9. Actions     what a button does: change state, save, repaint
    10. Init        event wiring and startup
   ========================================================================== */

// ===== 1. Config ============================================================

const STORAGE_KEY = 'contacts';

// avatar palette, taken from the CSS variables in :root so the colours are
// defined in one place instead of being repeated as hex codes here
const AVATAR_COLORS = [
  'var(--red)',
  'var(--blue)',
  'var(--green)',
  'var(--amber)',
  'var(--violet)',
  'var(--pink)',
];

// ===== 2. State =============================================================

// everything mutable lives here, so there is one place to look when the screen
// shows something unexpected
const state = {
  contacts: [], // the full list, the search box only filters what is drawn
  editIndex: null, // null while adding, the row index while editing
  photo: '', // data URL of the picked photo, '' when there is none
};

// ===== 3. Store =============================================================
// owns localStorage and the list itself. It never repaints: the caller decides
// when to redraw, which keeps a batch of changes from causing a render each.

const Store = {
  load() {
    state.contacts = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  },

  persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.contacts));
  },

  add(contact) {
    state.contacts.push(contact);
    Store.persist();
  },

  update(index, contact) {
    state.contacts[index] = contact;
    Store.persist();
  },

  remove(index) {
    state.contacts.splice(index, 1);
    Store.persist();
  },

  // flips favorite / emergency without a near-identical function for each
  toggle(index, field) {
    state.contacts[index][field] = !state.contacts[index][field];
    Store.persist();
  },

  at(index) {
    return state.contacts[index];
  },

  // Runs on a first visit only, so the page is not empty the first time it
  // opens. Once anything has been saved this never runs again.
  // Delete the call in init() to start empty.
  seedIfEmpty() {
    if (localStorage.getItem(STORAGE_KEY)) return;

    // prettier-ignore
    state.contacts = [
      { name: 'Ahmed Hassan',  phone: '01012345678', email: 'ahmed.hassan@gmail.com',  address: 'Nasr City, Cairo',    group: 'work',    favorite: true,  emergency: false, color: '#3b82f6' },
      { name: 'Sara Mohamed',  phone: '01123456789', email: 'sara.mohamed@yahoo.com',  address: 'Maadi, Cairo',        group: 'family',  favorite: false, emergency: true,  color: '#ec4899' },
      { name: 'Mohamed Ali',   phone: '01234567890', email: 'm.ali@outlook.com',       address: 'Dokki, Giza',         group: 'friends', favorite: false, emergency: false, color: '#10b981' },
      { name: 'Fatma Ibrahim', phone: '01512345678', email: '',                        address: 'Smouha, Alexandria',  group: 'family',  favorite: true,  emergency: true,  color: '#f59e0b' },
      { name: 'Omar Khaled',   phone: '01098765432', email: 'omar.khaled@hotmail.com', address: 'Heliopolis, Cairo',   group: 'work',    favorite: false, emergency: false, color: '#8b5cf6' },
      { name: 'Nour Adel',     phone: '01187654321', email: 'nour.adel@company.eg',    address: 'Zamalek, Cairo',      group: 'school',  favorite: false, emergency: false, color: '#ef4444' },
      { name: 'Youssef Sami',  phone: '01276543210', email: '',                        address: '',                    group: 'other',   favorite: false, emergency: true,  color: '#3b82f6' },
      { name: 'Mona Hassan',   phone: '01555555555', email: 'mona.hassan@gmail.com',   address: '6th of October',      group: 'friends', favorite: true,  emergency: false, color: '#10b981' },
    ].map((contact) => ({ ...contact, notes: '', photo: '' }));

    Store.persist();
  },
};

// ===== 4. Model =============================================================
// pure functions: same input, same output, no DOM and no popups. This is the
// part that could be unit tested or reused as-is on a server.

const Model = {
  // if no photo existed or uploaded, we put initials and Background color and is given random color
  initials(name) {
    return name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word[0].toUpperCase())
      .join('');
  },

  // the same number written differently is still the same number, so strip the
  // punctuation and fold an international prefix back to a local 0
  normalizePhone(phone) {
    return phone.replace(/[\s\-()+]/g, '').replace(/^(0020|20)/, '0');
  },

  // ignoreIndex skips the contact being edited, otherwise saving an edit
  // without changing the phone would report the contact as its own duplicate
  findDuplicatePhone(phone, ignoreIndex) {
    const target = Model.normalizePhone(phone);
    return state.contacts.find(
      (contact, index) =>
        index !== ignoreIndex && Model.normalizePhone(contact.phone) === target,
    );
  },

  matchesSearch(contact, term) {
    return (
      contact.name.toLowerCase().includes(term) ||
      contact.phone.includes(term) ||
      contact.email.toLowerCase().includes(term)
    );
  },

  randomColor() {
    return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
  },

  stats() {
    return {
      total: state.contacts.length,
      favorites: state.contacts.filter((contact) => contact.favorite).length,
      emergency: state.contacts.filter((contact) => contact.emergency).length,
    };
  },
};

// ===== 5. Validation ========================================================
// decides what is wrong, never what the user sees. Alerts does the showing.

const Validation = {
  // the keys here are also element ids: bindEvents() uses them to find the
  // fields, so they must keep matching the ids in index.html
  rules: {
    // must start with a capital (Arabic letters have no case, so they pass too)
    fullName: /^[A-Z؀-ۿ][A-Za-z؀-ۿ ]{2,29}$/,
    phoneNumber: /^(\+20|0)1[0125][0-9]{8}$/,
    // needs an @ and a domain ending: name@example.com, name@site.eg, name@a.co.uk
    emailAddress: /^[\w.%+-]+@[\w.-]+\.[a-z]{2,}$/i,
  },

  // live red / green styling while the user types
  // "!!text" means to turn text into a boolean type
  markField(input) {
    const text = input.value.trim();
    const passes = Validation.rules[input.id].test(text);
    input.classList.toggle('is-valid', !!text && passes);
    input.classList.toggle('is-invalid', !!text && !passes);
  },

  // returns [title, message] for the first problem found, or null when valid
  firstError() {
    const name = elements.fullName.value.trim();
    const phone = elements.phoneNumber.value.trim();
    const email = elements.emailAddress.value.trim();
    const duplicate = Model.findDuplicatePhone(phone, state.editIndex);

    // the first failing row wins, so this order is the order the user sees
    // prettier-ignore
    const checks = [
      [!name,                          'Missing Name',           'Please enter a name for the contact!'],
      [!Validation.rules.fullName.test(name),     'Invalid Name',           'Name must start with a capital letter and be 3 to 30 letters only!'],
      [!phone,                         'Missing Phone',          'Please enter a phone number!'],
      [!Validation.rules.phoneNumber.test(phone),  'Invalid Phone',          'Please enter a valid Egyptian phone number (e.g., 01012345678 or +201012345678)'],
      [!!duplicate,                    'Duplicate Phone Number', `A contact with this phone number already exists: ${duplicate?.name}`],
      [email && !Validation.rules.emailAddress.test(email),  'Invalid Email',          'Please enter a valid email address!'],
    ];
    const failed = checks.find(([isBad]) => isBad);
    return failed ? failed.slice(1) : null;
  },
};

// ===== 6. elements ==========================================================
// every element the app touches, looked up once instead of on every render

const elements = {
  // list + sidebar
  rowData: document.getElementById('rowData'),
  favoritesList: document.getElementById('favoritesList'),
  emergencyList: document.getElementById('emergencyList'),
  searchInput: document.getElementById('searchInput'),

  // stats
  totalContacts: document.getElementById('totalContacts'),
  favoritesCount: document.getElementById('favoritesCount'),
  emergencyCount: document.getElementById('emergencyCount'),
  contactsCount: document.getElementById('contactsCount'),

  // modal
  modalElement: document.getElementById('addContactModal'),
  modalTitle: document.getElementById('addContactModalLabel'),
  saveButton: document.getElementById('saveContactBtn'),
  updateButton: document.getElementById('updateContactBtn'),

  // form. fullName / phoneNumber / emailAddress are looked up by name in
  // bindEvents(), so those three keys must stay spelled like the element ids
  form: document.getElementById('contactForm'),
  fullName: document.getElementById('fullName'),
  phoneNumber: document.getElementById('phoneNumber'),
  emailAddress: document.getElementById('emailAddress'),
  address: document.getElementById('address'),
  group: document.getElementById('group'),
  notes: document.getElementById('notes'),
  isFavorite: document.getElementById('isFavorite'),
  isEmergency: document.getElementById('isEmergency'),
  photoInput: document.getElementById('photoInput'),
  photoPreview: document.querySelector('.contact-photo-preview'),
};

const modal = new bootstrap.Modal(elements.modalElement);

// ===== 7. Alerts ============================================================
// the only place SweetAlert is configured, so the popups stay consistent

const Alerts = {
  error(title, text) {
    Swal.fire({ icon: 'error', title, text });
  },

  success(title, text) {
    Swal.fire({
      icon: 'success',
      title,
      text,
      timer: 1500,
      showConfirmButton: false,
    });
  },

  confirmDelete(name) {
    return Swal.fire({
      title: 'Delete Contact?',
      text: `Are you sure you want to delete ${name}? This action cannot be undone.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, delete it!',
    }).then((result) => result.isConfirmed);
  },
};

// ===== 8. View ==============================================================
// state in, HTML out. It reads the state but never changes it.

const View = {
  // index is the position in state.contacts, which is what the buttons pass back
  contactCard(contact, index) {
    return `
      <div class="col-md-6">
        <div class="contact-card">
          <div class="contact-body">
            <div class="contact-header">
              <div class="contact-avatar ${contact.favorite ? 'favorite' : ''} ${contact.emergency ? 'emergency' : ''}"
                   style="background:${contact.color}">
                ${contact.photo ? `<img src="${contact.photo}" alt="">` : Model.initials(contact.name)}
              </div>
              <div class="contact-info">
                <h4>${contact.name}</h4>
                <div class="contact-detail phone">
                  <i class="fas fa-phone"></i><span>${contact.phone}</span>
                </div>
              </div>
            </div>
            <div class="contact-details">
              ${contact.email ? `<div class="contact-detail email"><i class="fas fa-envelope"></i><span>${contact.email}</span></div>` : ''}
              ${contact.address ? `<div class="contact-detail address"><i class="fas fa-map-marker-alt"></i><span>${contact.address}</span></div>` : ''}
            </div>
            <div class="contact-tags">
              ${contact.group ? `<span class="tag ${contact.group}">${contact.group}</span>` : ''}
              ${contact.emergency ? `<span class="tag emergency"><i class="fas fa-heartbeat"></i> Emergency</span>` : ''}
            </div>
          </div>
          <div class="contact-actions">
            <div class="action-group">
              <a class="contact-action call" title="Call" href="tel:${contact.phone}"><i class="fas fa-phone"></i></a>
              ${contact.email ? `<a class="contact-action email" title="Email" href="mailto:${contact.email}"><i class="fas fa-envelope"></i></a>` : ''}
            </div>
            <div class="action-group">
              <button class="contact-action favorite ${contact.favorite ? 'active' : ''}" title="Favorite"
                      onclick="Actions.toggleFavorite(${index})">
                <i class="${contact.favorite ? 'fas' : 'far'} fa-star"></i>
              </button>
              <button class="contact-action emergency ${contact.emergency ? 'active' : ''}" title="Emergency"
                      onclick="Actions.toggleEmergency(${index})">
                <i class="${contact.emergency ? 'fas' : 'far'} fa-heart"></i>
              </button>
              <button class="contact-action edit" title="Edit" onclick="Actions.edit(${index})">
                <i class="fas fa-pen"></i>
              </button>
              <button class="contact-action delete" title="Delete" onclick="Actions.remove(${index})">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </div>
        </div>
      </div>`;
  },

  sidebarCard(contact, callButtonClass) {
    return `
      <div class="sidebar-contact-card">
        <div class="sidebar-contact-avatar" style="background:${contact.color}">
          ${contact.photo ? `<img src="${contact.photo}" alt="">` : Model.initials(contact.name)}
        </div>
        <div class="sidebar-contact-info"><h5>${contact.name}</h5><p>${contact.phone}</p></div>
        <a class="sidebar-call-btn ${callButtonClass}" href="tel:${contact.phone}"><i class="fas fa-phone"></i></a>
      </div>`;
  },

  // always draws what the search box currently asks for, so the list stays
  // filtered after an add, edit, delete or favourite toggle
  renderContacts() {
    const searchTerm = elements.searchInput.value.trim().toLowerCase();
    let contactsList = '';

    // using matchesSearch for identifying the searched related contact
    // and adding the list of contactsList to show by using contactCard to appear the html component for the contactsList
    for (let index = 0; index < state.contacts.length; index++) {
      const contact = state.contacts[index];
      // if there is a match from the search then add it to contactsList list
      if (!Model.matchesSearch(contact, searchTerm)) continue;
      contactsList += View.contactCard(contact, index);
    }
    // if there is a contactsList filled then show it if not then render "no contacts"
    elements.rowData.innerHTML =
      contactsList ||
      `<div class="empty-state">
         <i class="fas fa-address-book"></i>
         <h4>No contacts found</h4>
         <p>Click "Add Contact" to get started</p>
       </div>`;
  },

  renderSidebar() {
    const favorites = state.contacts.filter((contact) => contact.favorite);
    const emergencies = state.contacts.filter((contact) => contact.emergency);

    elements.favoritesList.innerHTML = favorites.length
      ? favorites
          .map((contact) => View.sidebarCard(contact, 'favorites-call'))
          .join('')
      : `<p class="empty-state">No favorites yet</p>`;

    elements.emergencyList.innerHTML = emergencies.length
      ? emergencies
          .map((contact) => View.sidebarCard(contact, 'emergency-call'))
          .join('')
      : `<p class="empty-state">No emergency contacts</p>`;
  },

  renderStats() {
    const { total, favorites, emergency } = Model.stats();
    elements.totalContacts.innerText = total;
    elements.favoritesCount.innerText = favorites;
    elements.emergencyCount.innerText = emergency;
    elements.contactsCount.innerText = total;
  },

  // the single repaint entry point: every action ends with this
  render() {
    View.renderContacts();
    View.renderSidebar();
    View.renderStats();
  },
};

// ===== 9. Form ==============================================================
// reads and writes the modal only. Actions decides what to do with the data.

const Form = {
  read() {
    return {
      name: elements.fullName.value.trim(),
      phone: elements.phoneNumber.value.trim(),
      email: elements.emailAddress.value.trim(),
      address: elements.address.value.trim(),
      group: elements.group.value,
      notes: elements.notes.value.trim(),
      favorite: elements.isFavorite.checked,
      emergency: elements.isEmergency.checked,
      photo: state.photo,
      color: Model.randomColor(),
    };
  },

  fill(contact) {
    elements.fullName.value = contact.name;
    elements.phoneNumber.value = contact.phone;
    elements.emailAddress.value = contact.email;
    elements.address.value = contact.address;
    elements.group.value = contact.group;
    elements.notes.value = contact.notes;
    elements.isFavorite.checked = contact.favorite;
    elements.isEmergency.checked = contact.emergency;
    Form.showPhoto(contact.photo);
  },

  // the preview is a div, not an input, so it gets rebuilt instead of assigned
  showPhoto(photoSrc) {
    state.photo = photoSrc;
    elements.photoPreview.innerHTML = photoSrc
      ? `<img src="${photoSrc}" alt="">`
      : `<i class="fas fa-user"></i>`;
  },

  reset() {
    // swal built in reset
    elements.form.reset();
    state.editIndex = null;
    // initializing the photo
    Form.showPhoto('');
    // Removing States of valid and invalid
    elements.form
      .querySelectorAll('.form-control')
      .forEach((field) => field.classList.remove('is-valid', 'is-invalid'));
    elements.modalTitle.innerText = 'Add New Contact';
    elements.saveButton.classList.remove('d-none');
    elements.updateButton.classList.add('d-none');
  },

  // shows the alert and returns true when the form is not valid, so a caller
  // can guard with a single `if (Form.hasError()) return;`
  hasError() {
    const error = Validation.firstError();
    if (error) Alerts.error(error[0], error[1]);
    return !!error;
  },
};

// ===== 10. Actions ==========================================================

const Actions = {
  save() {
    if (Form.hasError()) return;
    Store.add(Form.read());
    View.render();
    modal.hide();
    Alerts.success('Added!', 'Contact has been added successfully.');
  },

  update() {
    if (Form.hasError()) return;
    // keep the original avatar colour, otherwise an edit reshuffles it
    const originalColor = Store.at(state.editIndex).color;
    Store.update(state.editIndex, {
      ...Form.read(),
      color: originalColor,
    });
    View.render();
    modal.hide();
    Alerts.success('Updated!', 'Contact has been updated successfully.');
  },

  edit(index) {
    state.editIndex = index;
    Form.fill(Store.at(index));
    elements.modalTitle.innerText = 'Edit Contact';
    elements.saveButton.classList.add('d-none');
    elements.updateButton.classList.remove('d-none');
    modal.show();
  },

  remove(index) {
    Alerts.confirmDelete(Store.at(index).name).then((confirmed) => {
      if (!confirmed) return;
      Store.remove(index);
      View.render();
      Alerts.success('Deleted!', 'Contact has been deleted.');
    });
  },

  toggleFavorite(index) {
    Store.toggle(index, 'favorite');
    View.render();
  },

  toggleEmergency(index) {
    Store.toggle(index, 'emergency');
    View.render();
  },
};

// ===== 11. Init =============================================================

function bindEvents() {
  elements.saveButton.addEventListener('click', Actions.save);
  elements.updateButton.addEventListener('click', Actions.update);
  elements.searchInput.addEventListener('input', View.renderContacts);

  // using this when pointing to the id tag in the html is what activate the function using the argument
  // of input value as in order to check with the validation rules by the input value that gets checked
  for (const fieldId in Validation.rules) {
    elements[fieldId].addEventListener('input', function () {
      Validation.markField(this);
    });
  }

  elements.photoInput.addEventListener('change', function () {
    const file = this.files[0];
    if (!file) return;
    // using the File Reader library to render and save the photos chosen in the pc
    const reader = new FileReader();
    reader.onload = (event) => Form.showPhoto(event.target.result);
    reader.readAsDataURL(file);
  });
  // reset the form whenever the modal closes, however it was closed
  elements.modalElement.addEventListener('hidden.bs.modal', Form.reset);
}

function init() {
  bindEvents();
  Store.load();
  Store.seedIfEmpty();
  View.render();
}

init();
