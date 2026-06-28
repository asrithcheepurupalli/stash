/**
 * Stash Pro license gate (Gumroad).
 *
 * Pro is a $39 one-time purchase on Gumroad, which issues a license key. The user
 * pastes that key in the dashboard; we verify it against Gumroad's API and, on
 * success, flip pro_active on (cached locally, so Pro keeps working offline).
 *
 * Privacy: the base extension talks to NOTHING. The only network call Stash ever
 * makes is this verification, and we do not even hold the permission for it until
 * the user clicks Activate (optional_host_permissions, requested on the gesture).
 *
 * SETUP (one-time): create the $39 product on Gumroad, then set PRODUCT_ID below
 * to its product id (Gumroad product settings > "Product ID", or the /l/ permalink
 * slug also works). Until this is set, the dashboard keeps the dev toggle instead.
 */
(function () {
  // Gumroad product_id (the hash, NOT the 'stashpro' permalink). Gumroad's verify
  // endpoint requires this exact value; you can read it from the verify API error
  // or the product's advanced settings.
  const PRODUCT_ID = 'lxi__iAiNXv8FmQWuvFhTA==';
  const VERIFY_URL = 'https://api.gumroad.com/v2/licenses/verify';
  const ORIGIN = 'https://api.gumroad.com/*';

  const configured = () => !!PRODUCT_ID;

  function getState() {
    return new Promise((res) => chrome.storage.local.get({ pro_active: false, license_key: '', license_email: '' }, res));
  }
  function setState(s) {
    return new Promise((res) => chrome.storage.local.set(s, res));
  }

  // Request the Gumroad host permission lazily, on the activation click.
  async function ensurePermission() {
    if (!chrome.permissions) return true;
    try {
      if (await chrome.permissions.contains({ origins: [ORIGIN] })) return true;
      return await chrome.permissions.request({ origins: [ORIGIN] });
    } catch (_e) {
      return false;
    }
  }

  async function verify(rawKey) {
    const key = (rawKey || '').trim();
    if (!key) return { ok: false, error: 'Paste your license key first.' };
    if (!configured()) return { ok: false, error: 'Licensing is not set up yet.' };
    if (!(await ensurePermission())) return { ok: false, error: 'Stash needs permission to verify with Gumroad. Activation cancelled.' };

    // Gumroad's verify endpoint identifies the product by either `product_id`
    // (a hash) or `product_permalink` (the slug). We hold one configured value
    // and try it as both, so it works whichever form the account uses.
    async function attempt(param) {
      const body = new URLSearchParams({ [param]: PRODUCT_ID, license_key: key, increment_uses_count: 'false' });
      const r = await fetch(VERIFY_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
      return r.json();
    }

    let data;
    try {
      data = await attempt('product_id');
      if (!data || !data.success) {
        const alt = await attempt('product_permalink');
        if (alt && alt.success) data = alt;
      }
    } catch (_e) {
      return { ok: false, error: 'Could not reach Gumroad. Check your connection and try again.' };
    }

    if (!data || !data.success) return { ok: false, error: 'That key was not recognised. Copy it exactly from your Gumroad receipt.' };
    const p = data.purchase || {};
    if (p.refunded || p.disputed || p.chargebacked) return { ok: false, error: 'This license is no longer active (refunded or disputed).' };

    await setState({ pro_active: true, license_key: key, license_email: p.email || '' });
    return { ok: true, email: p.email || '' };
  }

  async function clear() {
    await setState({ pro_active: false, license_key: '', license_email: '' });
  }

  window.StashLicense = { configured, getState, verify, clear, PRODUCT_ID };
})();
