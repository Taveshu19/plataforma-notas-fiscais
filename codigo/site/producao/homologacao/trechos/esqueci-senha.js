
  // ---- Esqueci minha senha (Gustavo, 14/11/2026) ----
  // O botão "Esqueci minha senha" pede à função recuperar-senha um e-mail com o link de troca (enviado pela caixa da escrituração).
  // Quem abre o link chega com ?recuperar=<token>: o painel pede a nova senha, confirma o token (verifyOtp) e grava a senha.
  function ligarEsqueci(){
    const b = document.getElementById('gateEsqueci'), recado = document.getElementById('gateRecado');
    if (!b || !recado || b.dataset.ligado) return;
    b.dataset.ligado = '1';
    b.addEventListener('click', async () => {
      const campo = document.getElementById('loginEmail'), email = (campo?.value || '').trim().toLowerCase();
      const erro = document.getElementById('loginErro'); if (erro) erro.textContent = '';
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){ recado.textContent = 'Digite o seu e-mail no campo acima e clique de novo em "Esqueci minha senha".'; campo?.focus(); return; }
      b.disabled = true; recado.textContent = 'Enviando…';
      try {
        await fetch(`${SUPABASE_URL}/functions/v1/recuperar-senha`, { method:'POST', headers:{ 'Content-Type':'application/json', apikey:SUPABASE_ANON_KEY }, body:JSON.stringify({ email }) });
        recado.textContent = `Se ${email} tiver acesso ao painel, enviamos um link para criar uma nova senha. Confira a caixa de entrada e o lixo eletrônico. O link vale por 1 hora.`;
      } catch (e) { recado.textContent = 'Não foi possível pedir agora. Verifique a internet e tente de novo.'; }
      finally { setTimeout(() => { b.disabled = false; }, 30000); }
    });
  }
  function telaNovaSenha(token){
    const fundo = document.createElement('div');
    fundo.id = 'cxNovaSenha';
    fundo.setAttribute('style', 'position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;background:rgb(10 14 20 / .82);padding:16px;font:14px/1.5 system-ui,sans-serif');
    const campo = id => `<input type="password" id="${id}" autocomplete="new-password" style="display:block;width:100%;box-sizing:border-box;margin-top:4px;padding:9px;border:1px solid #c9d1dc;border-radius:6px;font:inherit">`;
    fundo.innerHTML = `<form style="width:min(420px,100%);background:#fff;color:#17202f;border-radius:10px;padding:26px" novalidate>
      <h2 style="margin:0 0 6px;font-size:22px">Criar nova senha</h2>
      <p style="margin:0 0 16px;color:#596473">Escolha uma senha com pelo menos 8 caracteres.</p>
      <label style="display:block;margin-bottom:10px">Nova senha${campo('cxNs1')}</label>
      <label style="display:block;margin-bottom:10px">Repita a nova senha${campo('cxNs2')}</label>
      <p id="cxNsMsg" role="status" style="min-height:20px;margin:6px 0 12px;color:#ae202b"></p>
      <button type="submit" style="width:100%;padding:10px;border:0;border-radius:6px;background:#1f4fd1;color:#fff;font:inherit;cursor:pointer">Salvar nova senha</button>
    </form>`;
    document.body.appendChild(fundo);
    const msg = fundo.querySelector('#cxNsMsg'), botao = fundo.querySelector('button');
    fundo.querySelector('#cxNs1').focus();
    fundo.querySelector('form').addEventListener('submit', async e => {
      e.preventDefault();
      const s1 = fundo.querySelector('#cxNs1').value, s2 = fundo.querySelector('#cxNs2').value;
      if (s1.length < 8){ msg.textContent = 'A senha precisa ter pelo menos 8 caracteres.'; return; }
      if (s1 !== s2){ msg.textContent = 'As duas senhas não são iguais.'; return; }
      botao.disabled = true; msg.style.color = '#596473'; msg.textContent = 'Salvando…';
      try {
        const v = await cliente.auth.verifyOtp({ type:'recovery', token_hash:token });
        if (v.error) throw new Error('Este link expirou ou já foi usado. Peça outro em "Esqueci minha senha".');
        const u = await cliente.auth.updateUser({ password:s1, data:{ precisa_trocar_senha:false } });
        if (u.error) throw new Error(/same|different/i.test(u.error.message) ? 'A nova senha precisa ser diferente da anterior.' : u.error.message);
        msg.style.color = '#1b7a3d'; msg.textContent = 'Senha alterada. Abrindo o painel…';
        setTimeout(() => location.replace(location.pathname), 1200);
      } catch (erro) { msg.style.color = '#ae202b'; msg.textContent = erro.message; botao.disabled = false; }
    });
  }
  const tokenRecuperacao = new URLSearchParams(location.search).get('recuperar');
  if (tokenRecuperacao){ history.replaceState(null, '', location.pathname); telaNovaSenha(tokenRecuperacao); }
  ligarEsqueci(); document.addEventListener('DOMContentLoaded', ligarEsqueci);
