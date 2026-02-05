// supabaseClient.js

// 1. Definição das Chaves
const _SUPABASE_URL = 'https://lkimzjshxyqctennjydk.supabase.co';
const _SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxraW16anNoeHlxY3Rlbm5qeWRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyMDY0MDQsImV4cCI6MjA4NTc4MjQwNH0.vbVbOZ-93OF6vztnPkE6DruysNJnHfwgr5bOXLurCtE';

// 2. Verificação de Segurança (Para evitar o erro "undefined")
if (typeof window.supabase === 'undefined' || !window.supabase.createClient) {
    console.error("ERRO CRÍTICO: A biblioteca do Supabase não carregou. Verifique o HTML.");
    alert("Erro de conexão. Por favor, recarregue a página.");
} else {
    // 3. Criação da Conexão GLOBAL chamada 'supa'
    window.supa = window.supabase.createClient(_SUPABASE_URL, _SUPABASE_KEY);
    console.log("Conexão com Banco iniciada com sucesso (Variável: supa)");
}

// 4. Função auxiliar de login (opcional, usada no admin)
async function checkUser() {
    const { data: { session } } = await window.supa.auth.getSession();
    if (!session) {
        window.location.href = 'login.html'; 
    }
    return session;
}