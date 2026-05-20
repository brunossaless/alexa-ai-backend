# Modelo de interação (pt-BR)

O backend sozinho **não** remove a necessidade de frases de ativação na Alexa: quem reconhece a fala é o **Interaction Model** no Developer Console.

## Atualizar no console

1. [Alexa Developer Console](https://developer.amazon.com/alexa/console/ask) → sua skill → **Build** → **Interaction Model** → **pt-BR**
2. Abra `pt-BR.interaction-model.json` desta pasta
3. Copie o conteúdo de `interactionModel.languageModel` (ou importe o JSON, se o console permitir)
4. Confirme que o intent `GptQueryIntent` tem slot `query` do tipo **AMAZON.SearchQuery**
5. **Save Model** → **Build Model**

## Frases que passam a funcionar (sem "perguntar")

- para que serve o azox
- o que é inteligência artificial
- como está a maré hoje
- qual é a capital do Brasil
- me diga a previsão do tempo

A Amazon exige um pouco de texto fixo antes do slot `{query}`; por isso há várias amostras (`para que serve`, `como está`, `o que é`, etc.), não uma palavra mágica `perguntar`.

## Invocation name

O JSON usa `agente pessoal`. Se o seu invocation name for outro, altere no JSON e no console antes de publicar.
