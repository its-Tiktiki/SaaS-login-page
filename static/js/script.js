const views = document.querySelectorAll('[data-view]');
const notice = document.getElementById('notice');
const signinForm = document.getElementById('signin-form');
const signupForm = document.getElementById('signup-form');

function showView(name, { focus = true } = {}) {
    views.forEach((el) => {
        el.hidden = el.dataset.view !== name;
    });

    notice.hidden = true;
    document.title = name === 'signup' ? 'NEXORA | Create account' : 'NEXORA | Sign In';

    if (focus) {
        const form = name === 'signup' ? signupForm : signinForm;
        form.querySelector('input').focus();
    }
}

window.addEventListener('hashchange', () => {
    showView(location.hash === '#signup' ? 'signup' : 'signin');
});

showView(location.hash === '#signup' ? 'signup' : 'signin', { focus: false });

function setError(input, message) {
    const error = document.getElementById(`${input.id}-error`);
    const group = input.closest('.input-group');

    if (!error) {
        return;
    }

    error.textContent = message;
    error.hidden = false;
    input.setAttribute('aria-invalid', 'true');
    input.setAttribute('aria-describedby', error.id);

    if (group) {
        group.classList.add('invalid');
    }
}

function clearError(input) {
    const error = document.getElementById(`${input.id}-error`);
    const group = input.closest('.input-group');

    if (!error) {
        return;
    }

    error.hidden = true;
    input.removeAttribute('aria-invalid');
    input.removeAttribute('aria-describedby');

    if (group) {
        group.classList.remove('invalid');
    }
}

[signinForm, signupForm].forEach((form) => {
    form.querySelectorAll('input').forEach((input) => {
        input.addEventListener('input', () => clearError(input));
        input.addEventListener('change', () => clearError(input));
    });
});

async function postJSON(url, payload) {
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    let data = {};

    try {
        data = await response.json();
    } catch (error) {
        data = {};
    }

    return { ok: response.ok, status: response.status, data };
}

signupForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const name = document.getElementById('signup-name');
    const email = document.getElementById('signup-email');
    const password = document.getElementById('signup-password');
    const confirm = document.getElementById('signup-confirm');
    const terms = document.getElementById('terms');
    const button = signupForm.querySelector('.submit-btn');

    signupForm.querySelectorAll('input').forEach(clearError);

    const problems = [];

    if (name.value.trim().length < 2) {
        problems.push([name, 'Enter your full name.']);
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) {
        problems.push([email, 'Enter a valid email address, like you@company.com.']);
    }

    if (password.value.length < 8) {
        problems.push([password, 'Use at least 8 characters.']);
    }

    if (confirm.value !== password.value || confirm.value === '') {
        problems.push([confirm, 'Passwords don\u2019t match.']);
    }

    if (!terms.checked) {
        problems.push([terms, 'Accept the Terms and Privacy Policy to continue.']);
    }

    if (problems.length > 0) {
        problems.forEach(([input, message]) => setError(input, message));
        problems[0][0].focus();
        return;
    }

    button.disabled = true;

    try {
        const { ok, data } = await postJSON('/signup', {
            name: name.value.trim(),
            email: email.value.trim(),
            password: password.value
        });

        if (ok) {
            document.getElementById('signin-email').value = email.value.trim();

            signupForm.reset();
            showView('signin', { focus: false });
            history.replaceState(null, '', '#signin');

            notice.textContent = data.message;
            notice.hidden = false;
            document.getElementById('signin-password').focus();
            return;
        }

        const fields = { name, email, password };
        let firstBad = null;

        Object.entries(data.errors || {}).forEach(([field, message]) => {
            if (fields[field]) {
                setError(fields[field], message);
                firstBad = firstBad || fields[field];
            }
        });

        if (firstBad) {
            firstBad.focus();
        } else {
            setError(confirm, 'Something went wrong. Try again.');
        }
    } catch (error) {
        setError(confirm, 'Couldn\u2019t reach the server. Try again.');
    } finally {
        button.disabled = false;
    }
});

signinForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const email = document.getElementById('signin-email');
    const password = document.getElementById('signin-password');
    const remember = document.getElementById('remember');
    const button = signinForm.querySelector('.submit-btn');

    signinForm.querySelectorAll('input').forEach(clearError);
    button.disabled = true;

    try {
        const { ok, data } = await postJSON('/signin', {
            email: email.value.trim(),
            password: password.value,
            remember: remember.checked
        });

        if (ok) {
            window.location.href = data.redirect;
            return;
        }

        setError(password, (data.errors && data.errors.password) || 'Something went wrong. Try again.');
        password.focus();
    } catch (error) {
        setError(password, 'Couldn\u2019t reach the server. Try again.');
    } finally {
        button.disabled = false;
    }
});

document.querySelectorAll('.toggle-pass').forEach((button) => {
    const input = button.closest('.input-group').querySelector('input');

    button.addEventListener('click', () => {
        const isHidden = input.type === 'password';

        input.type = isHidden ? 'text' : 'password';
        button.setAttribute('aria-pressed', String(isHidden));
        button.setAttribute('aria-label', isHidden ? 'Hide password' : 'Show password');
    });
});

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (!reduceMotion) {
    document.querySelectorAll('[data-count]').forEach((el) => {
        const target = Number(el.dataset.count);
        const duration = 1200;
        const start = performance.now() + 700;

        const tick = (now) => {
            const progress = Math.min(Math.max(now - start, 0) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            const value = Math.round(target * eased);

            el.textContent = String(value).padStart(2, '0');

            if (progress < 1) {
                requestAnimationFrame(tick);
            }
        };

        el.textContent = '00';
        requestAnimationFrame(tick);
    });
}

const brandPanel = document.querySelector('.brand-panel');
const canHover = window.matchMedia('(hover: hover)').matches;

if (brandPanel && canHover && !reduceMotion) {
    let targetX = 0;
    let targetY = 0;
    let currentX = null;
    let currentY = null;
    let running = false;

    const follow = () => {
        currentX += (targetX - currentX) * 0.12;
        currentY += (targetY - currentY) * 0.12;

        brandPanel.style.setProperty('--mx', `${currentX}px`);
        brandPanel.style.setProperty('--my', `${currentY}px`);

        if (Math.abs(targetX - currentX) > 0.5 || Math.abs(targetY - currentY) > 0.5) {
            requestAnimationFrame(follow);
        } else {
            running = false;
        }
    };

    brandPanel.addEventListener('mousemove', (event) => {
        const rect = brandPanel.getBoundingClientRect();

        targetX = event.clientX - rect.left;
        targetY = event.clientY - rect.top;

        if (currentX === null) {
            currentX = targetX;
            currentY = targetY;
        }

        if (!running) {
            running = true;
            requestAnimationFrame(follow);
        }
    });
}

const activityInfo = document.querySelector('.activity-info');

if (activityInfo && !reduceMotion) {
    const updates = [
        { title: 'Alex updated the landing page', time: '2 minutes ago' },
        { title: 'Jordan completed 3 tasks', time: 'Just now' },
        { title: 'Sam added a new project', time: '5 minutes ago' },
        { title: 'Maya invited 2 teammates', time: '8 minutes ago' }
    ];

    const titleEl = activityInfo.querySelector('h4');
    const timeEl = activityInfo.querySelector('p');
    let index = 0;

    setInterval(() => {
        activityInfo.classList.add('is-out');

        setTimeout(() => {
            index = (index + 1) % updates.length;
            titleEl.textContent = updates[index].title;
            timeEl.textContent = updates[index].time;

            activityInfo.classList.remove('is-out');
            activityInfo.classList.add('is-in');
            void activityInfo.offsetWidth;
            activityInfo.classList.remove('is-in');
        }, 350);
    }, 4000);
}