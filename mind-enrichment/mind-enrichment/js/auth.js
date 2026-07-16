// ============================================================================
// AUTH.JS — real Supabase-backed signup/login/logout
// Depends on `sb` (the Supabase client) from config.js, and on showView()/
// showDashPanel()/showEduDashPanel() from ui.js.
// ============================================================================

/* ---------------- SIGN-IN MODAL ---------------- */

let signinType = 'parent';

let signinMode = 'login'; // 'login' | 'signup'

let currentUser = null; // { id, email, role, name } once signed in

function openSignin(){
  document.getElementById('signin-overlay').classList.remove('hidden');
}

function closeSignin(){
  document.getElementById('signin-overlay').classList.add('hidden');
  switchSigninMode('login'); // reset for next time it's opened
}

function closeSigninOnOverlay(ev){ if(ev.target.id === 'signin-overlay') closeSignin(); }

function setSigninType(type){
  signinType = type;
  document.getElementById('signin-tab-parent').classList.toggle('active', type==='parent');
  document.getElementById('signin-tab-educator').classList.toggle('active', type==='educator');
  document.getElementById('signin-type-label').textContent = type==='parent' ? 'Parent' : 'Educator';
  updateSigninFieldVisibility();
}

function updateSigninFieldVisibility(){
  const isSignup = signinMode === 'signup';
  document.getElementById('signin-parent-fields').style.display = (isSignup && signinType==='parent') ? 'block' : 'none';
  document.getElementById('signin-educator-fields').style.display = (isSignup && signinType==='educator') ? 'block' : 'none';
}

function switchSigninMode(mode){
  signinMode = mode;
  const isSignup = mode === 'signup';
  document.getElementById('signin-title').textContent = isSignup ? 'Create your account' : 'Sign in to Mind Enrichment';
  document.getElementById('signin-subtitle').textContent = isSignup ? 'Tell us a little about yourself to get started.' : 'Choose your account type to continue.';
  document.getElementById('signin-name-field').style.display = isSignup ? 'block' : 'none';
  document.getElementById('signin-submit-label').innerHTML = isSignup
    ? 'Create account as <span id="signin-type-label">'+(signinType==='parent'?'Parent':'Educator')+'</span>'
    : 'Sign in as <span id="signin-type-label">'+(signinType==='parent'?'Parent':'Educator')+'</span>';
  document.getElementById('signin-toggle-line').innerHTML = isSignup
    ? 'Already have an account? <span style="color:var(--blue);font-weight:600;cursor:pointer;" onclick="switchSigninMode(\'login\')">Sign in</span>'
    : 'New to Mind Enrichment? <span style="color:var(--blue);font-weight:600;cursor:pointer;" onclick="switchSigninMode(\'signup\')">Create an account</span>';
  document.getElementById('signin-error').style.display = 'none';
  updateSigninFieldVisibility();
}

function showSigninError(message){
  const el = document.getElementById('signin-error');
  el.textContent = message;
  el.style.display = 'block';
}

function setSigninLoading(loading){
  const btn = document.getElementById('signin-submit-btn');
  btn.disabled = loading;
  btn.style.opacity = loading ? '0.6' : '1';
}

async function confirmSignin(){
  const email = document.getElementById('signin-email-input').value.trim();
  const password = document.getElementById('signin-password-input').value;
  document.getElementById('signin-error').style.display = 'none';

  if(!email || !password){
    showSigninError('Please fill in your email and password.');
    return;
  }

  setSigninLoading(true);

  if(signinMode === 'signup'){
    const fullName = document.getElementById('signin-name-input').value.trim();
    const metadata = { role: signinType, full_name: fullName };

    if(signinType === 'parent'){
      metadata.child_name = document.getElementById('signin-child-name-input').value.trim();
      metadata.child_level = document.getElementById('signin-child-level-input').value;
    } else {
      metadata.headline = document.getElementById('signin-headline-input').value.trim();
      metadata.bio = document.getElementById('signin-bio-input').value.trim();
      metadata.years_experience = document.getElementById('signin-years-input').value;
      metadata.teaching_mode = 'hybrid';
    }

    const { data, error } = await sb.auth.signUp({ email, password, options: { data: metadata } });
    setSigninLoading(false);

    if(error){ showSigninError(error.message); return; }

    if(!data.session){
      // Email confirmation is required on this Supabase project — the profile
      // was still saved server-side via the signup trigger, they just need to
      // confirm before logging in.
      showSigninError("Almost there — check your email (" + email + ") to confirm your account, then sign in.");
      return;
    }

    currentUser = { id: data.user.id, email, role: signinType, name: fullName };
    document.getElementById('btn-signin').textContent = 'My Dashboard';
    closeSignin();
    showView(signinType==='parent' ? 'parent' : 'educator');

  } else {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if(error){ setSigninLoading(false); showSigninError(error.message); return; }

    const { data: profile, error: profileError } = await sb
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .single();

    setSigninLoading(false);

    if(profileError || !profile){
      showSigninError("Signed in, but couldn't load your account type. Please try again.");
      return;
    }

    currentUser = { id: data.user.id, email, role: profile.role, name: null };
    document.getElementById('btn-signin').textContent = 'My Dashboard';
    closeSignin();
    showView(profile.role==='parent' ? 'parent' : 'educator');
  }
}

async function signOutUser(){
  await sb.auth.signOut();
  currentUser = null;
  document.getElementById('btn-signin').textContent = 'Sign in';
  showView('market');
}

function handleSigninButtonClick(){
  if(currentUser){
    showView(currentUser.role==='parent' ? 'parent' : 'educator');
  } else {
    openSignin();
  }
}

async function restoreSession(){
  const { data: { session } } = await sb.auth.getSession();
  if(!session) return;

  const { data: profile } = await sb.from('profiles').select('role').eq('id', session.user.id).single();
  if(!profile) return;

  currentUser = { id: session.user.id, email: session.user.email, role: profile.role, name: null };
  document.getElementById('btn-signin').textContent = 'My Dashboard';
}

