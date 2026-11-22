    // Anexo de contrato/aditivo (14/11): só o Marcos envia (o banco confere). O arquivo vai ao bucket privado 'contratos'.
    async anexarContrato(contratoId, arquivo, recarregar = true){
      const caminho = `${contratoId}/${Date.now()}-${arquivo.name.normalize('NFD').replace(/[^\w.-]+/g, '_')}`;
      conferir(await cliente.storage.from('contratos').upload(caminho, arquivo, { contentType:arquivo.type || undefined }));
      const r = await cliente.rpc('contratos_registrar_arquivo', { p_contrato:contratoId, p_nome:arquivo.name, p_caminho:caminho, p_tamanho:arquivo.size });
      if (r.error){ await cliente.storage.from('contratos').remove([caminho]); throw new Error(r.error.message); }
      if (recarregar) await carregarAprovacoes();
    },
    async recarregarContratos(){ await carregarAprovacoes(); },
