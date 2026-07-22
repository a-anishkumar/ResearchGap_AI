const ACRONYM_MAP = {
  llm: 'LLM', llms: 'LLMs',
  nlp: 'NLP',
  rag: 'RAG',
  xai: 'XAI',
  cnn: 'CNN', cnns: 'CNNs',
  rnn: 'RNN', rnns: 'RNNs',
  gan: 'GAN', gans: 'GANs',
  bert: 'BERT',
  gpt: 'GPT', gpt3: 'GPT-3', gpt4: 'GPT-4',
  ml: 'ML',
  ai: 'AI',
  cv: 'CV',
  rl: 'RL',
  api: 'API', apis: 'APIs',
  json: 'JSON',
  gnn: 'GNN', gnns: 'GNNs',
  svm: 'SVM',
  lstm: 'LSTM',
}

/**
 * Format raw entity strings to clean, properly cased titles with acronym preservation.
 * e.g., "large language models (llms)" -> "Large Language Models (LLMs)"
 *       "medical nlp" -> "Medical NLP"
 */
export function formatNodeLabel(text) {
  if (!text) return ''
  return text.split(/\s+/).map(word => {
    const cleanWord = word.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
    if (ACRONYM_MAP[cleanWord]) {
      return word.replace(new RegExp(cleanWord, 'i'), ACRONYM_MAP[cleanWord])
    }
    if (word.length > 1 && word === word.toUpperCase()) return word
    return word.charAt(0).toUpperCase() + word.slice(1)
  }).join(' ')
}
