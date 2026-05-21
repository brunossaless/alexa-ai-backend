# Modelo de interação (pt-BR)

O backend sozinho **não** remove a necessidade de frases de ativação na Alexa: quem reconhece a fala é o **Interaction Model** no Developer Console.

## Atualizar no console

1. [Alexa Developer Console](https://developer.amazon.com/alexa/console/ask) → sua skill → **Build** → **Interaction Model** → **pt-BR**
2. Abra `pt-BR.interaction-model.json` desta pasta
3. Copie o conteúdo de `interactionModel.languageModel` (ou importe o JSON, se o console permitir)
4. Confirme que o intent `GptQueryIntent` tem slot `query` do tipo **AMAZON.SearchQuery**
5. **Save Model** → **Build Model**

## Frases que passam a funcionar

- para que serve o azox
- o que é inteligência artificial
- como está a maré hoje
- **o que acontece no episódio dois temporada quatro de better call saul**
- me fale sobre breaking bad

Há amostras com texto fixo (`o que é`, `como está`, …) e também **`{query}`** sozinho, para perguntas longas e abertas.

**Importante:** depois de editar este JSON, é obrigatório **Save Model** e **Build Model** no console. Só atualizar o backend no Render **não** muda o que a Alexa entende.

## Invocation name

O JSON usa `agente pessoal`. Se o seu invocation name for outro, altere no JSON e no console antes de publicar.
