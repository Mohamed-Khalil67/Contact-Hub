// ===== 1. Setup =============================================================
// constants, shared state, and cached DOM references everything else depends on

const STORAGE_KEY = 'contacts';

// matches the CSS custom properties in :root so colours live in one place
const AVATAR_COLORS = [
  'var(--red)',
  'var(--blue)',
  'var(--green)',
  'var(--amber)',
  'var(--violet)',
  'var(--pink)',
];

// all mutable app state in one place — easier to debug when the screen looks wrong
const state = {
  contacts: [], // the full list; the search box only filters what is drawn
  editIndex: null, // null while adding, the contact's array index while editing
  photo: '', // data URL of the picked photo, '' when there is none
};

// every DOM element the app touches, looked up once at load time
const elements = {
  // list + sidebar
  rowData: document.getElementById('rowData'),
  favoritesList: document.getElementById('favoritesList'),
  emergencyList: document.getElementById('emergencyList'),
  searchInput: document.getElementById('searchInput'),

  // stats bar
  totalContacts: document.getElementById('totalContacts'),
  favoritesCount: document.getElementById('favoritesCount'),
  emergencyCount: document.getElementById('emergencyCount'),
  contactsCount: document.getElementById('contactsCount'),

  // modal chrome
  modalElement: document.getElementById('addContactModal'),
  modalTitle: document.getElementById('addContactModalLabel'),
  saveButton: document.getElementById('saveContactBtn'),
  updateButton: document.getElementById('updateContactBtn'),

  // form fields — fullName / phoneNumber / emailAddress keys must match the
  // element ids because bindEvents iterates them by name
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

// keys match element ids so bindEvents can attach listeners by iterating this object
const validationRules = {
  // Arabic letters have no uppercase, so they pass the capital-start check automatically
  fullName: /^[A-Z؀-ۿ][A-Za-z؀-ۿ ]{2,29}$/,
  phoneNumber: /^(\+20|0)1[0125][0-9]{8}$/,
  // requires name@domain.tld — the {2,} on the TLD rejects bare .c endings
  emailAddress: /^[\w.%+-]+@[\w.-]+\.[a-z]{2,}$/i,
};

// ===== 2. Storage ===========================================================
// all localStorage reads and writes go through these functions

// reads saved contacts from localStorage, or starts with an empty list
function loadContacts() {
  state.contacts = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
}

// writes the current list to localStorage
function persistContacts() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.contacts));
}

// appends a new contact to the end of the list
function addContact(contact) {
  state.contacts.push(contact);
  persistContacts();
}

// returns the contact at the given array position
function getContact(index) {
  return state.contacts[index];
}

// replaces the contact at the given position
function updateContactAt(index, contact) {
  state.contacts[index] = contact;
  persistContacts();
}

// removes the contact at the given position
function removeContactAt(index) {
  state.contacts.splice(index, 1);
  persistContacts();
}

// flips one boolean field (favorite or emergency) on the contact at index
function toggleContactAt(index, field) {
  state.contacts[index][field] = !state.contacts[index][field];
  persistContacts();
}

// seeds demo contacts on the very first visit; skipped once localStorage has data
// delete the call in init() if you want to start with an empty list
function seedIfEmpty() {
  if (localStorage.getItem(STORAGE_KEY)) return;

  // prettier-ignore
  state.contacts = [
    { name: 'Ahmed Hassan',  phone: '01012345678', email: 'ahmed.hassan@gmail.com',  address: 'Nasr City, Cairo',   group: 'work',    favorite: true,  emergency: false, color: '#3b82f6' },
    { name: 'Sara Mohamed',  phone: '01123456789', email: 'sara.mohamed@yahoo.com',  address: 'Maadi, Cairo',       group: 'family',  favorite: false, emergency: true,  color: '#ec4899' },
    { name: 'Mohamed Ali',   phone: '01234567890', email: 'm.ali@outlook.com',       address: 'Dokki, Giza',        group: 'friends', favorite: false, emergency: false, color: '#10b981' },
    { name: 'Fatma Ibrahim', phone: '01512345678', email: '',                        address: 'Smouha, Alexandria', group: 'family',  favorite: true,  emergency: true,  color: '#f59e0b' },
    { name: 'Omar Khaled',   phone: '01098765432', email: 'omar.khaled@hotmail.com', address: 'Heliopolis, Cairo',  group: 'work',    favorite: false, emergency: false, color: '#8b5cf6' },
    { name: 'Nour Adel',     phone: '01187654321', email: 'nour.adel@company.eg',    address: 'Zamalek, Cairo',     group: 'school',  favorite: false, emergency: false, color: '#ef4444' },
    { name: 'Youssef Sami',  phone: '01276543210', email: '',                        address: '',                   group: 'other',   favorite: false, emergency: true,  color: '#3b82f6' },
    { name: 'Mona Hassan',   phone: '01555555555', email: 'mona.hassan@gmail.com',   address: '6th of October',     group: 'friends', favorite: true,  emergency: false, color: '#10b981' },
  ].map((contact) => ({ ...contact, notes: '', photo: '' }));

  persistContacts();
}

// ===== 3. Display ===========================================================
// turns data into HTML; reads state but never changes it

// builds the HTML for one contact card; index is the position in state.contacts
// and gets baked into the onclick handlers so buttons act on the right contact
function buildContactCard(contact, index) {
  return `
      <div class="col-md-6">
        <div class="contact-card">
          <div class="contact-body">
            <div class="contact-header">
              <div class="contact-avatar ${contact.favorite ? 'favorite' : ''} ${contact.emergency ? 'emergency' : ''}"
                   style="background:${contact.color}">
                ${contact.photo ? `<img src="${contact.photo}" alt="">` : initials(contact.name)}
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
}

// builds the compact card shown in the sidebar lists
function buildSidebarCard(contact, callButtonClass) {
  return `
      <div class="sidebar-contact-card">
        <div class="sidebar-contact-avatar" style="background:${contact.color}">
          ${contact.photo ? `<img src="${contact.photo}" alt="">` : initials(contact.name)}
        </div>
        <div class="sidebar-contact-info"><h5>${contact.name}</h5><p>${contact.phone}</p></div>
        <a class="sidebar-call-btn ${callButtonClass}" href="tel:${contact.phone}"><i class="fas fa-phone"></i></a>
      </div>`;
}

// redraws the contact grid, applying whatever the search box currently says
function renderContacts() {
  const searchTerm = elements.searchInput.value.trim().toLowerCase();
  let contactsList = '';

  // loop the FULL array so `index` is the real position in state.contacts.
  // filter+map would renumber the survivors and the onclick handlers would
  // then point at the wrong contact once the list is filtered
  for (let index = 0; index < state.contacts.length; index++) {
    const contact = state.contacts[index];
    if (!matchesSearch(contact, searchTerm)) continue;
    contactsList += buildContactCard(contact, index);
  }

  // innerHTML rebuilds every card; that's intentional because the inline onclick
  // handlers are recreated fresh with each render rather than needing manual cleanup
  elements.rowData.innerHTML =
    contactsList ||
    `<div class="empty-state">
       <i class="fas fa-address-book"></i>
       <h4>No contacts found</h4>
       <p>Click "Add Contact" to get started</p>
     </div>`;
}

// redraws the favourites and emergency sidebar lists
function renderSidebar() {
  const favorites = state.contacts.filter((c) => c.favorite);
  const emergencies = state.contacts.filter((c) => c.emergency);

  elements.favoritesList.innerHTML = favorites.length
    ? favorites.map((c) => buildSidebarCard(c, 'favorites-call')).join('')
    : `<p class="empty-state">No favorites yet</p>`;

  elements.emergencyList.innerHTML = emergencies.length
    ? emergencies.map((c) => buildSidebarCard(c, 'emergency-call')).join('')
    : `<p class="empty-state">No emergency contacts</p>`;
}

// updates the three count badges in the header
function renderStats() {
  const { total, favorites, emergency } = contactStats();
  elements.totalContacts.innerText = total;
  elements.favoritesCount.innerText = favorites;
  elements.emergencyCount.innerText = emergency;
  elements.contactsCount.innerText = total;
}

// full repaint — call this after any change to state.contacts
function render() {
  renderContacts();
  renderSidebar();
  renderStats();
}

// ===== 4. Add contact =======================================================

// reads the current form values into a plain object
function readForm() {
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
    color: randomColor(),
  };
}

// applies live valid/invalid styling while the user types
function markField(input) {
  const text = input.value.trim();
  const passes = validationRules[input.id].test(text);
  // "!!" coerces the non-empty string to true so the toggle gets a real boolean
  input.classList.toggle('is-valid', !!text && passes);
  input.classList.toggle('is-invalid', !!text && !passes);
}

// returns [title, message] for the first problem found, or null when the form is valid
function firstError() {
  const name = elements.fullName.value.trim();
  const phone = elements.phoneNumber.value.trim();
  const email = elements.emailAddress.value.trim();
  // pass editIndex so the duplicate check skips the contact currently being edited
  const duplicate = findDuplicatePhone(phone, state.editIndex);

  // prettier-ignore
  const checks = [
    [!name,                                              'Missing Name',           'Please enter a name for the contact!'],
    [!validationRules.fullName.test(name),               'Invalid Name',           'Name must start with a capital letter and be 3 to 30 letters only!'],
    [!phone,                                             'Missing Phone',          'Please enter a phone number!'],
    [!validationRules.phoneNumber.test(phone),           'Invalid Phone',          'Please enter a valid Egyptian phone number (e.g., 01012345678 or +201012345678)'],
    [!!duplicate,                                        'Duplicate Phone Number', `A contact with this phone number already exists: ${duplicate?.name}`],
    [email && !validationRules.emailAddress.test(email), 'Invalid Email',          'Please enter a valid email address!'],
  ];
  const failed = checks.find(([isBad]) => isBad);
  return failed ? failed.slice(1) : null;
}

// shows the validation error popup and returns true when the form has a problem
function hasFormError() {
  const error = firstError();
  if (error) showErrorAlert(error[0], error[1]);
  return !!error;
}

// validates and saves a new contact
function saveContact() {
  if (hasFormError()) return;
  addContact(readForm());
  render();
  modal.hide();
  showSuccessAlert('Added!', 'Contact has been added successfully.');
}

// ===== 5. Edit / update contact =============================================

// fills the modal form with an existing contact's data
function fillForm(contact) {
  elements.fullName.value = contact.name;
  elements.phoneNumber.value = contact.phone;
  elements.emailAddress.value = contact.email;
  elements.address.value = contact.address;
  elements.group.value = contact.group;
  elements.notes.value = contact.notes;
  elements.isFavorite.checked = contact.favorite;
  elements.isEmergency.checked = contact.emergency;
  showPhoto(contact.photo);
}

// clears the form and returns the modal to "Add new contact" mode
function resetForm() {
  elements.form.reset();
  state.editIndex = null;
  showPhoto('');
  // remove any red/green field colouring left from the previous session
  elements.form
    .querySelectorAll('.form-control')
    .forEach((field) => field.classList.remove('is-valid', 'is-invalid'));
  elements.modalTitle.innerText = 'Add New Contact';
  elements.saveButton.classList.remove('d-none');
  elements.updateButton.classList.add('d-none');
}

// opens the modal pre-filled with the contact at that index
function editContact(index) {
  state.editIndex = index;
  fillForm(getContact(index));
  elements.modalTitle.innerText = 'Edit Contact';
  elements.saveButton.classList.add('d-none');
  elements.updateButton.classList.remove('d-none');
  modal.show();
}

// validates and saves the changes to the contact being edited
function updateContact() {
  if (hasFormError()) return;
  // keep the original avatar colour so an edit does not randomly reshuffle it
  const originalColor = getContact(state.editIndex).color;
  updateContactAt(state.editIndex, {
    ...readForm(),
    color: originalColor,
  });
  render();
  modal.hide();
  showSuccessAlert('Updated!', 'Contact has been updated successfully.');
}

// ===== 6. Delete contact ====================================================

// asks for confirmation then permanently removes the contact at that index
function removeContact(index) {
  confirmDelete(getContact(index).name).then((confirmed) => {
    if (!confirmed) return;
    removeContactAt(index);
    render();
    showSuccessAlert('Deleted!', 'Contact has been deleted.');
  });
}

// ===== 7. Favourite / emergency toggles =====================================

// flips the favourite star and redraws
function toggleFavorite(index) {
  toggleContactAt(index, 'favorite');
  render();
}

// flips the emergency badge and redraws
function toggleEmergency(index) {
  toggleContactAt(index, 'emergency');
  render();
}

// ===== 8. Search ============================================================
// filtering runs inside renderContacts on every call, reading the search box
// live. the input listener that triggers it is wired up in bindEvents.

// ===== 9. Photo upload ======================================================

// updates the photo preview and stores the data URL in state
function showPhoto(photoSrc) {
  state.photo = photoSrc;
  // the preview is a div, not an input, so it needs innerHTML rather than .value
  elements.photoPreview.innerHTML = photoSrc
    ? `<img src="${photoSrc}" alt="">`
    : `<i class="fas fa-user"></i>`;
}

// ===== 10. Helpers ==========================================================
// pure functions — same input, same output, no DOM, no side effects

// returns up to two initials from a name, used when there is no photo
function initials(name) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('');
}

// strips punctuation and folds the international prefix so +201... and 01... compare equal
function normalizePhone(phone) {
  return phone.replace(/[\s\-()+]/g, '').replace(/^(0020|20)/, '0');
}

// returns the first contact whose phone matches, skipping the one being edited.
// when ignoreIndex is null (adding), no contact is skipped
function findDuplicatePhone(phone, ignoreIndex) {
  const target = normalizePhone(phone);
  return state.contacts.find(
    (contact, index) =>
      index !== ignoreIndex && normalizePhone(contact.phone) === target,
  );
}

// true when name, phone, or email contains the search term
function matchesSearch(contact, term) {
  return (
    contact.name.toLowerCase().includes(term) ||
    contact.phone.includes(term) ||
    contact.email.toLowerCase().includes(term)
  );
}

// picks a random colour from the CSS palette defined in :root
function randomColor() {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
}

// returns total, favourite, and emergency counts for the stats bar
function contactStats() {
  return {
    total: state.contacts.length,
    favorites: state.contacts.filter((c) => c.favorite).length,
    emergency: state.contacts.filter((c) => c.emergency).length,
  };
}

// SweetAlert wrappers — one place to change popup style across the whole app
function showErrorAlert(title, text) {
  Swal.fire({ icon: 'error', title, text });
}

function showSuccessAlert(title, text) {
  Swal.fire({
    icon: 'success',
    title,
    text,
    timer: 1500,
    showConfirmButton: false,
  });
}

// returns a promise that resolves to true when the user confirms
function confirmDelete(name) {
  return Swal.fire({
    title: 'Delete Contact?',
    text: `Are you sure you want to delete ${name}? This action cannot be undone.`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    cancelButtonColor: '#6b7280',
    confirmButtonText: 'Yes, delete it!',
  }).then((result) => result.isConfirmed);
}

// ===== 11. Startup ==========================================================

// Actions is a global object because the onclick strings in buildContactCard
// reference it by name (e.g. Actions.edit, Actions.remove). everything else
// is a plain function and does not need a namespace wrapper.
const Actions = {
  save: saveContact,
  update: updateContact,
  edit: editContact,
  remove: removeContact,
  toggleFavorite,
  toggleEmergency,
};

// wires up every event listener in the app
function bindEvents() {
  elements.saveButton.addEventListener('click', saveContact);
  elements.updateButton.addEventListener('click', updateContact);
  // every keystroke rerenders the filtered list
  elements.searchInput.addEventListener('input', renderContacts);

  // `this` is the specific input that fired, giving markField the right element
  for (const fieldId in validationRules) {
    elements[fieldId].addEventListener('input', function () {
      markField(this);
    });
  }

  elements.photoInput.addEventListener('change', function () {
    const file = this.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => showPhoto(event.target.result);
    reader.readAsDataURL(file);
  });

  // reset whenever the modal closes, regardless of how it was dismissed
  elements.modalElement.addEventListener('hidden.bs.modal', resetForm);
}

function init() {
  bindEvents();
  loadContacts();
  seedIfEmpty();
  render();
}

init();
