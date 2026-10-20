# Teste temporário pela Cloudflare

O backend atual continua em PHP/Laravel, MySQL e Redis. Para testar a aplicação sem reescrevê-la para Workers, o Cloudflare Tunnel pode fornecer HTTPS temporário até os serviços existentes. Não é uma implantação em Workers nem hospedagem permanente.

## Estado verificado nesta execução

- Serviços Compose iniciados e saudáveis; migrations atualizadas.
- Quatro testes do gateway web passaram.
- `python scripts/cloudflare_preview.py --check-local` passou: configuração de origem HTTPS, console real, API protegida com HTTP 401 e arquivos privados com HTTP 404.
- O binário oficial cloudflared 2026.10.2 foi baixado do release GitHub por HTTPS com verificação TLS preservada.
- A tentativa real de túnel falhou: DNS do ambiente recusou a resolução de `api.trycloudflare.com`; uma chamada HTTPS pelo proxy também recebeu CONNECT 403. Não foi criado ou validado nenhum endereço público.

Os domínios necessários foram adicionados ao rascunho de rede. Salvar o rascunho não aplica essas alterações à máquina atual. A operação também depende de resolução DNS funcional e conectividade de saída do cloudflared aos edges da Cloudflare (TCP 7844 para HTTP/2). Uma lista de domínios HTTPS não comprova liberação desse protocolo; o ambiente precisa oferecer essa capacidade. Caso ela não esteja disponível, execute o comando em uma máquina/servidor compatível, ou use um túnel nomeado configurado nessa máquina.

## Executar quando houver conectividade

Da raiz do repositório:

```bash
docker compose up -d --wait database cache api worker web
docker compose exec -T api php scripts/artisan.php migrate --force --no-interaction
python scripts/cloudflare_preview.py --check-local
python scripts/cloudflare_preview.py
```

O comando usa `cloudflared` do PATH ou `.runtime/bin/cloudflared`. Para instalar a versão testada em Linux x86_64:

```bash
mkdir -p .runtime/bin
curl --fail --location --silent --show-error https://github.com/cloudflare/cloudflared/releases/download/2026.10.2/cloudflared-linux-amd64 -o .runtime/bin/cloudflared
chmod 755 .runtime/bin/cloudflared
```

A ponte HTTP escuta apenas em loopback e encaminha a um destino local fixo, com proteção de caminhos privados e autenticação nativa preservadas. A configuração da console recebe a origem HTTPS fornecida pelo túnel, evitando chamadas ao localhost no navegador remoto. O script só imprime o endereço após verificar a saúde e a configuração pela origem pública. Ele encerra o túnel em caso de falha ou Ctrl+C. Não são exigidas credenciais da conta Cloudflare para esse teste temporário.

O login nativo continua obrigatório. Este comando não cria nem publica senhas ou tokens. Contas sintéticas geradas pelos testes ficam no arquivo privado `.runtime/test-auth.json` e não devem ser expostas em logs ou no Git. Não coloque dados reais nesse acesso de demonstração. O endereço expira quando o processo/ambiente termina; um domínio estável exige hospedagem persistente e controle de acesso adequados.
