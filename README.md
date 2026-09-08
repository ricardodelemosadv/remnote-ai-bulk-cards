# IA — Cartões em Massa

Plugin do RemNote para computador, Android e iPad que transforma o texto selecionado em uma prévia editável de flashcards usando a API da OpenAI por meio de um serviço HTTPS protegido.

## Uso

1. Selecione um trecho em uma nota do RemNote.
2. Clique em **✨ Cartões em massa** no menu da seleção.
3. Gere os rascunhos, revise cada pergunta e resposta e desmarque o que não desejar.
4. Confirme **Criar cartões**. Os cards serão incluídos abaixo do Rem de origem.

A chave da OpenAI fica somente nas variáveis protegidas do servidor e nunca é incluída no plugin.
O plugin armazena apenas um código revogável no espaço sincronizado do usuário, para funcionar em
seus dispositivos. O ChatGPT e o computador não precisam estar abertos; é necessário acesso à
internet para gerar os rascunhos.
