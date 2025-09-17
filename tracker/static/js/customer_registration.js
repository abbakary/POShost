(function() {
  if (window._customerRegSetup) return; // Prevent double binding
  window._customerRegSetup = true;

  function qs(selector, root) { return (root || document).querySelector(selector); }
  function qsa(selector, root) { return Array.prototype.slice.call((root || document).querySelectorAll(selector)); }

  function enableIfExists(id) {
    var btn = document.getElementById(id);
    if (btn) btn.disabled = false;
  }

  function getCsrfToken(root) {
    var tokenInput = (root || document).querySelector('input[name="csrfmiddlewaretoken"]');
    return tokenInput ? tokenInput.value : null;
  }

  function parseHTML(html) {
    var parser = new DOMParser();
    return parser.parseFromString(html, 'text/html');
  }

  function replaceWizardFromDoc(doc, newUrl, push) {
    var newContainer = doc.getElementById('registrationWizard');
    var current = document.getElementById('registrationWizard');
    if (!newContainer || !current) {
      window.location.href = newUrl || window.location.href;
      return;
    }
    current.replaceWith(newContainer);
    if (push) {
      try { history.pushState({}, '', newUrl); } catch (e) {}
    } else if (newUrl) {
      try { history.replaceState({}, '', newUrl); } catch (e) {}
    }
    // Re-init behaviors on the new content
    initializeCustomerRegistration(newContainer);
    // Scroll into view to keep context stable
    newContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function fetchAndSwap(url, opts) {
    var res = await fetch(url, Object.assign({ credentials: 'same-origin', redirect: 'follow', headers: { 'X-Requested-With': 'XMLHttpRequest' } }, opts || {}));
    var finalUrl = res.url || url;
    var html = await res.text();
    // If we navigated away from registration page (e.g., detail redirect), hard navigate
    if (!/customer_register/.test(finalUrl)) {
      window.location.href = finalUrl;
      return;
    }
    var doc = parseHTML(html);
    replaceWizardFromDoc(doc, finalUrl, !!(opts && opts.method === 'GET'));
  }

  function bindPjaxNavigation(root) {
    // Delegated click handler for step links
    document.addEventListener('click', function(e) {
      var a = e.target.closest('a[data-step-link]');
      if (!a) return;
      if (a.target === '_blank' || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      fetchAndSwap(a.href, { method: 'GET' });
    });

    // Handle back/forward
    window.addEventListener('popstate', function() {
      fetchAndSwap(window.location.href, { method: 'GET' });
    });
  }

  function setupBrandUpdate(root) {
    var itemNameSelect = (root || document).getElementById('id_item_name');
    var brandSelect = (root || document).getElementById('id_brand');
    if (!itemNameSelect || !brandSelect) return;
    var brandsData = itemNameSelect.getAttribute('data-brands');
    var brandMapping = {};
    try { brandMapping = brandsData ? JSON.parse(brandsData) : {}; } catch (e) { brandMapping = {}; }
    itemNameSelect.addEventListener('change', function() {
      var selectedItem = this.value;
      var brandName = brandMapping[selectedItem];
      if (brandName) {
        for (var i = 0; i < brandSelect.options.length; i++) {
          if (brandSelect.options[i].text === brandName) { brandSelect.selectedIndex = i; break; }
        }
      }
    });
  }

  function setupCustomerTypeFields(root) {
    var customerTypeSelect = (root || document).querySelector('select[name="customer_type"]');
    if (!customerTypeSelect) return;
    function toggleFields() {
      var selectedType = customerTypeSelect.value;
      var organizationField = document.getElementById('organization-field');
      var taxField = document.getElementById('tax-field');
      var personalSubtypeField = document.getElementById('personal-subtype-field');
      [organizationField, taxField, personalSubtypeField].forEach(function(field) {
        if (field) {
          field.style.display = 'none';
          var inputs = field.querySelectorAll('input, select, textarea');
          inputs.forEach(function(input){ input.removeAttribute('required'); });
        }
      });
      if (selectedType === 'personal') {
        if (personalSubtypeField) {
          personalSubtypeField.style.display = 'block';
          var subtypeSelect = personalSubtypeField.querySelector('select');
          if (subtypeSelect) subtypeSelect.setAttribute('required', 'required');
        }
      } else if (['government','ngo','company'].indexOf(selectedType) !== -1) {
        if (organizationField) {
          organizationField.style.display = 'block';
          var orgInput = organizationField.querySelector('input');
          if (orgInput) orgInput.setAttribute('required', 'required');
        }
        if (taxField) {
          taxField.style.display = 'block';
          var taxInput = taxField.querySelector('input');
          if (taxInput) taxInput.setAttribute('required', 'required');
        }
      }
      setTimeout(function(){
        [organizationField, taxField, personalSubtypeField].forEach(function(field){
          if (field && field.style.display === 'block') {
            field.classList.add('animate-in');
            setTimeout(function(){ field.classList.remove('animate-in'); }, 400);
          }
        });
      }, 50);
    }
    toggleFields();
    customerTypeSelect.addEventListener('change', toggleFields);
  }

  function setupIntentCards(root) {
    var container = root || document;
    var intentCards = qsa('.intent-card', container);
    var intentRadios = qsa('input[name="intent"]', container);
    function updateStyles() {
      intentCards.forEach(function(card){
        var radio = card.querySelector('input[type="radio"]');
        if (radio && radio.checked) card.classList.add('selected'); else card.classList.remove('selected');
      });
      // Enable next button when any radio selected
      if (intentRadios.some(function(r){ return r.checked; })) enableIfExists('nextStepBtn');
    }
    intentCards.forEach(function(card){
      card.addEventListener('click', function(){
        var radio = card.querySelector('input[type="radio"]');
        if (radio) { radio.checked = true; updateStyles(); }
      });
    });
    intentRadios.forEach(function(r){ r.addEventListener('change', updateStyles); });
    updateStyles();
  }

  function setupServiceType(root) {
    var container = root || document;
    var serviceTypeRadios = qsa('input[name="service_type"]', container);
    var serviceDetails = container.getElementById ? container.getElementById('service-details') : document.getElementById('service-details');
    function onChange() {
      // Enable next button when selected
      if (serviceTypeRadios.some(function(r){ return r.checked; })) enableIfExists('nextServiceBtn');
    }
    serviceTypeRadios.forEach(function(r){ r.addEventListener('change', onChange); });
    onChange();
    if (serviceTypeRadios.length && serviceDetails) {
      serviceTypeRadios.forEach(function(radio){
        radio.addEventListener('change', function(){
          if (this.checked) {
            fetch('/service-form/' + this.value + '/')
              .then(function(response){ return response.text(); })
              .then(function(html){ serviceDetails.innerHTML = html; })
              .catch(function(err){ console.error('Error loading service form:', err); });
          }
        });
      });
    }
  }

  async function checkDuplicateCustomer(root) {
    var nameEl = (root || document).getElementById('id_full_name');
    var phoneEl = (root || document).getElementById('id_phone');
    var typeEl = (root || document).getElementById('id_customer_type');
    var orgEl = (root || document).getElementById('id_organization_name');
    var taxEl = (root || document).getElementById('id_tax_number');
    if (!nameEl || !phoneEl) return null;
    var full_name = (nameEl.value || '').trim();
    var phone = (phoneEl.value || '').trim();
    var customer_type = typeEl ? (typeEl.value || '').trim() : '';
    var organization_name = orgEl ? (orgEl.value || '').trim() : '';
    var tax_number = taxEl ? (taxEl.value || '').trim() : '';
    if (!full_name || !phone) return null;
    var params = new URLSearchParams({ full_name: full_name, phone: phone, customer_type: customer_type, organization_name: organization_name, tax_number: tax_number });
    var res = await fetch('/api/customers/check-duplicate/?' + params.toString(), { headers: { 'Accept': 'application/json' } });
    if (!res.ok) return null;
    return res.json();
  }

  function showExistingCustomerModal(data) {
    var modalEl = document.getElementById('existingCustomerModal');
    if (!modalEl || !data || !data.customer) return;
    var c = data.customer;
    qs('#existingCustomerName').textContent = c.full_name || '';
    qs('#existingCustomerCode').textContent = c.code || '';
    qs('#existingCustomerPhone').textContent = c.phone || '';
    qs('#existingCustomerType').textContent = (c.customer_type || 'personal');
    qs('#existingCustomerOrg').textContent = c.organization_name || '-';
    qs('#existingCustomerTax').textContent = c.tax_number || '-';
    qs('#existingCustomerEmail').textContent = c.email || '-';
    qs('#existingCustomerVisits').textContent = c.total_visits != null ? c.total_visits : '-';
    qs('#existingCustomerAddress').textContent = c.address || '-';
    var orderBtn = document.getElementById('existingCustomerCreateOrderBtn');
    var viewBtn = document.getElementById('existingCustomerViewBtn');
    if (orderBtn) orderBtn.setAttribute('href', c.create_order_url);
    if (viewBtn) viewBtn.setAttribute('href', c.detail_url);
    var bsModal = new bootstrap.Modal(modalEl);
    bsModal.show();
  }

  function setupForm(root) {
    var container = root || document;
    var form = container.querySelector('form');
    if (!form) return;

    // Phone auto-format
    var phoneInput = form.querySelector('input[name="phone"]');
    if (phoneInput) {
      phoneInput.addEventListener('input', function(e){
        var value = e.target.value.replace(/\D/g, '');
        if (value.length > 13) value = value.substring(0, 13);
        e.target.value = value;
      });
    }

    // Auto-save to localStorage
    function saveFormData() {
      var fd = new FormData(form);
      var obj = {};
      fd.forEach(function(value, key){ obj[key] = value; });
      localStorage.setItem('customerRegistrationData', JSON.stringify(obj));
    }
    function loadFormData() {
      var saved = localStorage.getItem('customerRegistrationData');
      if (!saved) return;
      try {
        var data = JSON.parse(saved);
        Object.keys(data).forEach(function(key){
          var el = form.querySelector('[name="' + key + '"]');
          if (el) {
            if (el.type === 'checkbox' || el.type === 'radio') {
              el.checked = (data[key] === 'true' || data[key] === el.value);
            } else {
              el.value = data[key];
            }
          }
        });
      } catch (e) {
        console.error('Error loading form data:', e);
        localStorage.removeItem('customerRegistrationData');
      }
    }
    loadFormData();
    form.addEventListener('input', saveFormData);

    form.addEventListener('submit', async function(e) {
      var requiredFields = form.querySelectorAll('[required]');
      var isValid = true;
      requiredFields.forEach(function(field){
        if (!String(field.value || '').trim()) { field.classList.add('is-invalid'); isValid = false; }
        else { field.classList.remove('is-invalid'); }
      });
      if (!isValid) {
        e.preventDefault();
        var firstInvalid = form.querySelector('.is-invalid');
        if (firstInvalid) firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      e.preventDefault();
      var stepInput = form.querySelector('input[name="step"]');
      var currentStep = stepInput ? parseInt(stepInput.value, 10) : null;
      if (currentStep === 1) {
        var result = await checkDuplicateCustomer(form);
        if (result && result.exists) { showExistingCustomerModal(result); return; }
      }
      var submitter = e.submitter;
      if (submitter && submitter.name) {
        // Ensure the clicked submit button's name/value are included
        var hidden = document.createElement('input');
        hidden.type = 'hidden'; hidden.name = submitter.name; hidden.value = submitter.value; form.appendChild(hidden);
      }
      var fd = new FormData(form);
      var headers = { 'X-Requested-With': 'XMLHttpRequest' };
      var csrftoken = getCsrfToken(form);
      if (csrftoken) headers['X-CSRFToken'] = csrftoken;
      fetchAndSwap(window.location.pathname + window.location.search, { method: 'POST', body: fd, headers: headers, credentials: 'same-origin', redirect: 'follow' });
      // Clear saved draft on submit
      localStorage.removeItem('customerRegistrationData');
    });
  }

  function initializeCustomerRegistration(root) {
    setupBrandUpdate(root);
    setupCustomerTypeFields(root);
    setupIntentCards(root);
    setupServiceType(root);
    setupForm(root);
    // Tooltips
    qsa('[data-bs-toggle="tooltip"]', root).forEach(function(el){ new bootstrap.Tooltip(el); });
  }
  window.initializeCustomerRegistration = initializeCustomerRegistration;

  // First-time init
  bindPjaxNavigation();
  initializeCustomerRegistration();
})();
