# ResearchGap AI — Extraction Evaluation Report

**Fixtures evaluated:** 10
**Entity types scored:** methods, domains, datasets
**Matching strategy:** Normalized token set overlap (case-insensitive, punctuation-stripped)

## Per-Fixture Results

| Fixture | Methods P | Methods R | Methods F1 | Domains P | Domains R | Domains F1 | Datasets P | Datasets R | Datasets F1 |
|---------|-----------|-----------|------------|-----------|-----------|------------|------------|------------|-------------|
| fixture_01.json | 1.00 | 1.00 | **1.00** | 1.00 | 1.00 | **1.00** | 1.00 | 1.00 | **1.00** |
| fixture_02.json | 1.00 | 1.00 | **1.00** | 1.00 | 1.00 | **1.00** | 1.00 | 1.00 | **1.00** |
| fixture_03.json | 1.00 | 1.00 | **1.00** | 1.00 | 1.00 | **1.00** | 1.00 | 1.00 | **1.00** |
| fixture_04.json | 1.00 | 1.00 | **1.00** | 1.00 | 1.00 | **1.00** | 1.00 | 1.00 | **1.00** |
| fixture_05.json | 1.00 | 1.00 | **1.00** | 1.00 | 1.00 | **1.00** | 1.00 | 1.00 | **1.00** |
| fixture_06.json | 1.00 | 1.00 | **1.00** | 1.00 | 1.00 | **1.00** | 1.00 | 1.00 | **1.00** |
| fixture_07.json | 1.00 | 1.00 | **1.00** | 1.00 | 1.00 | **1.00** | 1.00 | 1.00 | **1.00** |
| fixture_08.json | 1.00 | 1.00 | **1.00** | 1.00 | 1.00 | **1.00** | 1.00 | 1.00 | **1.00** |
| fixture_09.json | 1.00 | 1.00 | **1.00** | 1.00 | 1.00 | **1.00** | 1.00 | 1.00 | **1.00** |
| fixture_10.json | 1.00 | 1.00 | **1.00** | 1.00 | 1.00 | **1.00** | 1.00 | 1.00 | **1.00** |

## Aggregate Scores (Macro-Average)

| Entity Type | Avg Precision | Avg Recall | **Avg F1** |
|-------------|---------------|------------|-----------|
| Methods | 1.000 | 1.000 | **1.000** |
| Domains | 1.000 | 1.000 | **1.000** |
| Datasets | 1.000 | 1.000 | **1.000** |

## Detailed Predictions vs Gold

### fixture_01.json
**Title:** Fine-Tuning BERT for Text Classification

**Methods** (F1=1.00)
- Gold: ['BERT', 'Fine-Tuning', 'Transformer']
- Predicted: ['BERT', 'Fine-Tuning', 'Transformer']

**Domains** (F1=1.00)
- Gold: ['NLP', 'Text Classification']
- Predicted: ['NLP', 'Text Classification']

**Datasets** (F1=1.00)
- Gold: ['SST-2', 'IMDb']
- Predicted: ['Sst-2', 'Imdb']

### fixture_02.json
**Title:** Bidirectional LSTM for Sentiment Analysis

**Methods** (F1=1.00)
- Gold: ['LSTM', 'Bidirectional LSTM', 'Attention Mechanism']
- Predicted: ['LSTM', 'Bidirectional LSTM', 'Attention Mechanism']

**Domains** (F1=1.00)
- Gold: ['Sentiment Analysis', 'NLP']
- Predicted: ['Sentiment Analysis', 'NLP']

**Datasets** (F1=1.00)
- Gold: ['Amazon Reviews', 'Yelp Dataset']
- Predicted: ['Amazon Reviews', 'Yelp Dataset']

### fixture_03.json
**Title:** Deep CNN for Medical Image Classification

**Methods** (F1=1.00)
- Gold: ['CNN', 'ResNet', 'Transfer Learning']
- Predicted: ['CNN', 'Resnet', 'Transfer Learning']

**Domains** (F1=1.00)
- Gold: ['Medical Imaging', 'Computer Vision']
- Predicted: ['Medical Imaging', 'Computer Vision']

**Datasets** (F1=1.00)
- Gold: ['ChestX-ray14']
- Predicted: ['Chestx-Ray14']

### fixture_04.json
**Title:** Transformer for Low-Resource Machine Translation

**Methods** (F1=1.00)
- Gold: ['Transformer', 'Attention Mechanism', 'Self-Attention']
- Predicted: ['Transformer', 'Attention Mechanism', 'Self-Attention']

**Domains** (F1=1.00)
- Gold: ['Machine Translation', 'Low-Resource NLP']
- Predicted: ['Machine Translation', 'Low-Resource NLP']

**Datasets** (F1=1.00)
- Gold: ['FLORES-101', 'WMT2021']
- Predicted: ['Flores-101', 'Wmt2021']

### fixture_05.json
**Title:** GPT-3 Language Models as Few-Shot Learners

**Methods** (F1=1.00)
- Gold: ['GPT-3', 'Few-Shot Learning', 'Language Model']
- Predicted: ['GPT-3', 'Few-Shot Learning', 'Language Model']

**Domains** (F1=1.00)
- Gold: ['NLP', 'Few-Shot Learning']
- Predicted: ['NLP', 'Few-Shot Learning']

**Datasets** (F1=1.00)
- Gold: ['SuperGLUE', 'TriviaQA']
- Predicted: ['Superglue', 'Triviaqa']

### fixture_06.json
**Title:** Random Forest for Healthcare Tabular Data

**Methods** (F1=1.00)
- Gold: ['Random Forest', 'Ensemble Learning', 'Feature Selection']
- Predicted: ['Random Forest', 'Ensemble Learning', 'Feature Selection']

**Domains** (F1=1.00)
- Gold: ['Healthcare AI', 'Predictive Modeling']
- Predicted: ['Healthcare AI', 'Predictive Modeling']

**Datasets** (F1=1.00)
- Gold: ['MIMIC-III', 'PhysioNet']
- Predicted: ['Mimic-Iii', 'Physionet']

### fixture_07.json
**Title:** Deep RL for Robotic Manipulation

**Methods** (F1=1.00)
- Gold: ['Reinforcement Learning', 'Deep Q-Network', 'Policy Gradient']
- Predicted: ['Reinforcement Learning', 'Deep Q-Network', 'Policy Gradient']

**Domains** (F1=1.00)
- Gold: ['Robotics', 'Control Systems']
- Predicted: ['Robotics', 'Control Systems']

**Datasets** (F1=1.00)
- Gold: ['OpenAI Gym', 'MuJoCo']
- Predicted: ['Openai Gym', 'Mujoco']

### fixture_08.json
**Title:** Conditional GAN for Image Synthesis

**Methods** (F1=1.00)
- Gold: ['GAN', 'Conditional GAN']
- Predicted: ['GAN', 'Conditional GAN']

**Domains** (F1=1.00)
- Gold: ['Computer Vision', 'Generative AI']
- Predicted: ['Computer Vision', 'Generative AI']

**Datasets** (F1=1.00)
- Gold: ['CelebA-HQ', 'FFHQ']
- Predicted: ['Celeba-Hq', 'Ffhq']

### fixture_09.json
**Title:** BioBERT for Biomedical Named Entity Recognition

**Methods** (F1=1.00)
- Gold: ['BERT', 'BioBERT', 'NER']
- Predicted: ['BERT', 'Biobert', 'NER']

**Domains** (F1=1.00)
- Gold: ['Biomedical NLP', 'Clinical NLP']
- Predicted: ['Biomedical NLP', 'Clinical NLP']

**Datasets** (F1=1.00)
- Gold: ['BC5CDR', 'NCBI Disease']
- Predicted: ['Bc5cdr', 'Ncbi Disease']

### fixture_10.json
**Title:** XLNet for Long Legal Document Classification

**Methods** (F1=1.00)
- Gold: ['XLNet', 'Document Classification']
- Predicted: ['XLNet', 'Document Classification']

**Domains** (F1=1.00)
- Gold: ['Document AI', 'Legal NLP']
- Predicted: ['Document AI', 'Legal NLP']

**Datasets** (F1=1.00)
- Gold: ['ECtHR Dataset', 'EURLEX']
- Predicted: ['Ecthr Dataset', 'Eurlex']

---

*Generated by `tests/eval/eval_extraction.py`*
*Entity matching uses normalized string set overlap (case-insensitive)*