import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const auth = req.headers.authorization || '';
    const token = auth.replace(/^Bearer\s+/i, '');
    if (!token) {
      return res.status(401).json({ error: 'Sign in required' });
    }

    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon =
      process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !anon || !service) {
      return res.status(500).json({ error: 'Supabase server variables are not configured' });
    }

    const userClient = createClient(url, anon, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const {
      data: { user },
      error: uerr,
    } = await userClient.auth.getUser(token);

    if (uerr || !user) {
      return res.status(401).json({ error: 'Invalid session' });
    }

    const { workspace_id, email } = req.body || {};
    if (!workspace_id || !email) {
      return res.status(400).json({ error: 'workspace_id and email are required' });
    }

    const admin = createClient(url, service);

    const { data: ws, error: werr } = await admin
      .from('workspaces')
      .select('id,created_by')
      .eq('id', workspace_id)
      .single();

    if (werr || !ws) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    if (ws.created_by !== user.id) {
      return res.status(403).json({ error: 'Only the workspace owner can invite people' });
    }

    const { data: inv, error: ierr } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { invited_to_workspace: workspace_id },
    });

    if (ierr) {
      return res.status(400).json({ error: ierr.message });
    }

    await admin.from('workspace_members').upsert({
      workspace_id,
      user_id: inv.user.id,
      email,
      role: 'member',
    });

    return res.json({ ok: true, user_id: inv.user.id });
  } catch (e) {
    console.error('invite error', e);
    return res.status(500).json({ error: e.message || 'Server error' });
  }
}
