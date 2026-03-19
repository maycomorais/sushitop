// supabaseClient.js

const _SUPABASE_URL = 'https://lkimzjshxyqctennjydk.supabase.co';
const _SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxraW16anNoeHlxY3Rlbm5qeWRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyMDY0MDQsImV4cCI6MjA4NTc4MjQwNH0.vbVbOZ-93OF6vztnPkE6DruysNJnHfwgr5bOXLurCtE';

if (typeof window.supabase === 'undefined' || !window.supabase.createClient) {
    console.error('ERRO CRÍTICO: A biblioteca do Supabase não carregou.');
    alert('Erro de conexão. Por favor, recarregue a página.');
} else {
    // Guard: só cria o cliente UMA vez (evita lock contention no auth)
    if (!window.supa) {
        window.supa = window.supabase.createClient(_SUPABASE_URL, _SUPABASE_KEY, {
            auth: {
                // Evita refresh automático simultâneo que causa o lock error
                autoRefreshToken: true,
                persistSession: true,
                detectSessionInUrl: false
            }
        });
        console.log('Sushi Top — Banco iniciado com sucesso');
    } else {
        console.log('Sushi Top — Reusando cliente existente (guard ativo)');
    }
}

async function checkUser() {
    const { data: { session } } = await window.supa.auth.getSession();
    if (!session) {
        window.location.href = 'login.html';
    }
    return session;
}
