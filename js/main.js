// ===== Data =====
let contacts = JSON.parse(localStorage.getItem('contacts')) || [];
let editIndex = null;
let photo = '';

// avatar palette, taken from the CSS variables in :root so the colours are
// defined in one place instead of being repeated as hex codes here
const colors = [
  'var(--red)',
  'var(--blue)',
  'var(--green)',
  'var(--amber)',
  'var(--violet)',
  'var(--pink)',
];

// ===== Elements =====
const rowData = document.getElementById('rowData');
const favoritesList = document.getElementById('favoritesList');
const emergencyList = document.getElementById('emergencyList');
const searchInput = document.getElementById('searchInput');
const modal = new bootstrap.Modal(document.getElementById('addContactModal'));
const saveBtn = document.getElementById('saveContactBtn');
const updateBtn = document.getElementById('updateContactBtn');
const photoInput = document.getElementById('photoInput');
const photoPreview = document.querySelector('.contact-photo-preview');

// ===== Validation rules =====
const rules = {
  // must start with a capital (Arabic letters have no case, so they pass too)
  fullName: /^[A-Z؀-ۿ][A-Za-z؀-ۿ ]{2,29}$/,
  phoneNumber: /^(\+20|0)1[0125][0-9]{8}$/,
  // needs an @ and a domain ending: name@example.com, name@site.eg, name@a.co.uk
  emailAddress: /^[\w.%+-]+@[\w.-]+\.[a-z]{2,}$/i,
};

function validateInput(input) {
  const isText = input.value.trim();
  const isRegex = rules[input.id].test(isText);
  input.classList.toggle('is-valid', !!isText && isRegex);
  input.classList.toggle('is-invalid', !!isText && !isRegex);
}

for (const id in rules) {
  document.getElementById(id).addEventListener('input', function () {
    validateInput(this);
  });
}

// returns [title, message] for the first problem found, or null if the form is valid
function getFormError() {
  const name = fullName.value.trim();
  const phone = phoneNumber.value.trim();
  const email = emailAddress.value.trim();

  if (!name) return ['Missing Name', 'Please enter a name for the contact!'];
  if (!rules.fullName.test(name))
    return [
      'Invalid Name',
      'Name must start with a capital letter and be 3 to 30 letters only!',
    ];
  if (!phone) return ['Missing Phone', 'Please enter a phone number!'];
  if (!rules.phoneNumber.test(phone))
    return [
      'Invalid Phone',
      'Please enter a valid Egyptian phone number (e.g., 01012345678 or +201012345678)',
    ];
  const clean = (p) => p.replace(/[\s\-()+]/g, '').replace(/^(0020|20)/, '0');
  const twin = contacts.find(
    (c, i) => i !== editIndex && clean(c.phone) === clean(phone),
  );
  if (twin)
    return [
      'Duplicate Phone Number',
      `A contact with this phone number already exists: ${twin.name}`,
    ];

  if (email && !rules.emailAddress.test(email))
    return ['Invalid Email', 'Please enter a valid email address!'];
  return null;
}

// shows the error alert and returns true when the form is not valid
function hasError() {
  const error = getFormError();
  if (error) Swal.fire({ icon: 'error', title: error[0], text: error[1] });
  return !!error;
}

// ===== Helpers =====
const initials = (name) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');

// every change goes through here: persist, then repaint
function save() {
  localStorage.setItem('contacts', JSON.stringify(contacts));
  display();
}

const toast = (title, text) =>
  Swal.fire({
    icon: 'success',
    title,
    text,
    timer: 1500,
    showConfirmButton: false,
  });

// ===== Read form / fill form =====
function getFormData() {
  return {
    name: fullName.value.trim(),
    phone: phoneNumber.value.trim(),
    email: emailAddress.value.trim(),
    address: address.value.trim(),
    group: group.value,
    notes: notes.value.trim(),
    favorite: isFavorite.checked,
    emergency: isEmergency.checked,
    photo: photo,
    color: colors[Math.floor(Math.random() * colors.length)],
  };
}

// the preview is a div, not an input, so it gets rebuilt instead of assigned
function showPhoto(src) {
  photo = src;
  photoPreview.innerHTML = src
    ? `<img src="${src}" alt="">`
    : `<i class="fas fa-user"></i>`;
}

function fillForm(c) {
  fullName.value = c.name;
  phoneNumber.value = c.phone;
  emailAddress.value = c.email;
  address.value = c.address;
  group.value = c.group;
  notes.value = c.notes;
  isFavorite.checked = c.favorite;
  isEmergency.checked = c.emergency;
  showPhoto(c.photo);
}

function resetForm() {
  document.getElementById('contactForm').reset();
  editIndex = null;
  showPhoto('');
  document
    .querySelectorAll('#contactForm .form-control')
    .forEach((i) => i.classList.remove('is-valid', 'is-invalid'));
  document.getElementById('addContactModalLabel').innerText = 'Add New Contact';
  saveBtn.classList.remove('d-none');
  updateBtn.classList.add('d-none');
}

// ===== Display =====
// always draws what the search box currently asks for, so the list stays
// filtered after an add, edit, delete or favourite toggle
function display() {
  const term = searchInput.value.trim().toLowerCase();
  let cards = '';

  // looping over contacts directly means i is already the real index, so the
  // buttons below don't need contacts.indexOf() to work it out again
  for (let i = 0; i < contacts.length; i++) {
    const c = contacts[i];
    const matches =
      c.name.toLowerCase().includes(term) ||
      c.phone.includes(term) ||
      c.email.toLowerCase().includes(term);
    if (!matches) continue;

    cards += `
      <div class="col-md-6">
        <div class="contact-card">
          <div class="contact-body">
            <div class="contact-header">
              <div class="contact-avatar ${c.favorite ? 'favorite' : ''} ${c.emergency ? 'emergency' : ''}"
                   style="background:${c.color}">
                ${c.photo ? `<img src="${c.photo}" alt="">` : initials(c.name)}
              </div>
              <div class="contact-info">
                <h4>${c.name}</h4>
                <div class="contact-detail phone">
                  <i class="fas fa-phone"></i><span>${c.phone}</span>
                </div>
              </div>
            </div>
            <div class="contact-details">
              ${c.email ? `<div class="contact-detail email"><i class="fas fa-envelope"></i><span>${c.email}</span></div>` : ''}
              ${c.address ? `<div class="contact-detail address"><i class="fas fa-map-marker-alt"></i><span>${c.address}</span></div>` : ''}
            </div>
            <div class="contact-tags">
              ${c.group ? `<span class="tag ${c.group}">${c.group}</span>` : ''}
              ${c.emergency ? `<span class="tag emergency"><i class="fas fa-heartbeat"></i> Emergency</span>` : ''}
            </div>
          </div>
          <div class="contact-actions">
            <div class="action-group">
              <a class="contact-action call" title="Call" href="tel:${c.phone}"><i class="fas fa-phone"></i></a>
              ${c.email ? `<a class="contact-action email" title="Email" href="mailto:${c.email}"><i class="fas fa-envelope"></i></a>` : ''}
            </div>
            <div class="action-group">
              <button class="contact-action favorite ${c.favorite ? 'active' : ''}" title="Favorite"
                      onclick="toggleFavorite(${i})">
                <i class="${c.favorite ? 'fas' : 'far'} fa-star"></i>
              </button>
              <button class="contact-action emergency ${c.emergency ? 'active' : ''}" title="Emergency"
                      onclick="toggleEmergency(${i})">
                <i class="${c.emergency ? 'fas' : 'far'} fa-heart"></i>
              </button>
              <button class="contact-action edit" title="Edit" onclick="editContact(${i})">
                <i class="fas fa-pen"></i>
              </button>
              <button class="contact-action delete" title="Delete" onclick="deleteContact(${i})">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </div>
        </div>
      </div>`;
  }

  rowData.innerHTML =
    cards ||
    `<div class="empty-state">
       <i class="fas fa-address-book"></i>
       <h4>No contacts found</h4>
       <p>Click "Add Contact" to get started</p>
     </div>`;

  displaySidebar();
  updateStats();
}

function sidebarCard(c, btnClass) {
  return `
    <div class="sidebar-contact-card">
      <div class="sidebar-contact-avatar" style="background:${c.color}">
        ${c.photo ? `<img src="${c.photo}" alt="">` : initials(c.name)}
      </div>
      <div class="sidebar-contact-info"><h5>${c.name}</h5><p>${c.phone}</p></div>
      <a class="sidebar-call-btn ${btnClass}" href="tel:${c.phone}"><i class="fas fa-phone"></i></a>
    </div>`;
}

function displaySidebar() {
  const favs = contacts.filter((c) => c.favorite);
  const emrs = contacts.filter((c) => c.emergency);
  favoritesList.innerHTML = favs.length
    ? favs.map((c) => sidebarCard(c, 'favorites-call')).join('')
    : `<p class="empty-state">No favorites yet</p>`;
  emergencyList.innerHTML = emrs.length
    ? emrs.map((c) => sidebarCard(c, 'emergency-call')).join('')
    : `<p class="empty-state">No emergency contacts</p>`;
}

function updateStats() {
  totalContacts.innerText = contacts.length;
  favoritesCount.innerText = contacts.filter((c) => c.favorite).length;
  emergencyCount.innerText = contacts.filter((c) => c.emergency).length;
  contactsCount.innerText = contacts.length;
}

// ===== CRUD =====
saveBtn.addEventListener('click', function () {
  if (hasError()) return;
  contacts.push(getFormData());
  save();
  modal.hide();
  toast('Added!', 'Contact has been added successfully.');
});

updateBtn.addEventListener('click', function () {
  if (hasError()) return;
  contacts[editIndex] = { ...getFormData(), color: contacts[editIndex].color };
  save();
  modal.hide();
  toast('Updated!', 'Contact has been updated successfully.');
});

function editContact(i) {
  editIndex = i;
  fillForm(contacts[i]);
  document.getElementById('addContactModalLabel').innerText = 'Edit Contact';
  saveBtn.classList.add('d-none');
  updateBtn.classList.remove('d-none');
  modal.show();
}

function deleteContact(i) {
  Swal.fire({
    title: 'Delete Contact?',
    text: `Are you sure you want to delete ${contacts[i].name}? This action cannot be undone.`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    cancelButtonColor: '#6b7280',
    confirmButtonText: 'Yes, delete it!',
  }).then((res) => {
    if (res.isConfirmed) {
      contacts.splice(i, 1);
      save();
      toast('Deleted!', 'Contact has been deleted.');
    }
  });
}

function toggleFavorite(i) {
  contacts[i].favorite = !contacts[i].favorite;
  save();
}

function toggleEmergency(i) {
  contacts[i].emergency = !contacts[i].emergency;
  save();
}

// ===== Search =====
searchInput.addEventListener('input', display);

// ===== Photo upload =====
photoInput.addEventListener('change', function () {
  const file = this.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => showPhoto(e.target.result);
  reader.readAsDataURL(file);
});

// reset the form whenever the modal closes
document
  .getElementById('addContactModal')
  .addEventListener('hidden.bs.modal', resetForm);

// ===== Sample data =====
// Runs on a first visit only, so the page is not empty the first time it opens.
// Once anything has been saved this never runs again. Delete it to start empty.
function seedSampleContacts() {
  if (localStorage.getItem('contacts')) return;

  // prettier-ignore
  contacts = [
    { name: 'Ahmed Hassan',  phone: '01012345678', email: 'ahmed.hassan@gmail.com',  address: 'Nasr City, Cairo',    group: 'work',    favorite: true,  emergency: false, color: '#3b82f6' },
    { name: 'Sara Mohamed',  phone: '01123456789', email: 'sara.mohamed@yahoo.com',  address: 'Maadi, Cairo',        group: 'family',  favorite: false, emergency: true,  color: '#ec4899' },
    { name: 'Mohamed Ali',   phone: '01234567890', email: 'm.ali@outlook.com',       address: 'Dokki, Giza',         group: 'friends', favorite: false, emergency: false, color: '#10b981' },
    { name: 'Fatma Ibrahim', phone: '01512345678', email: '',                        address: 'Smouha, Alexandria',  group: 'family',  favorite: true,  emergency: true,  color: '#f59e0b' },
    { name: 'Omar Khaled',   phone: '01098765432', email: 'omar.khaled@hotmail.com', address: 'Heliopolis, Cairo',   group: 'work',    favorite: false, emergency: false, color: '#8b5cf6' },
    { name: 'Nour Adel',     phone: '01187654321', email: 'nour.adel@company.eg',    address: 'Zamalek, Cairo',      group: 'school',  favorite: false, emergency: false, color: '#ef4444' },
    { name: 'Youssef Sami',  phone: '01276543210', email: '',                        address: '',                    group: 'other',   favorite: false, emergency: true,  color: '#3b82f6' },
    { name: 'Mona Hassan',   phone: '01555555555', email: 'mona.hassan@gmail.com',   address: '6th of October',      group: 'friends', favorite: true,  emergency: false, color: '#10b981' },
  ].map((c) => ({ ...c, notes: '', photo: '' }));

  localStorage.setItem('contacts', JSON.stringify(contacts));
}

// ===== Start =====
seedSampleContacts();
display();
