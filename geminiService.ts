// geminiService.ts - Serviço Gemini com Cache Otimizado
import { GoogleGenAI, Type } from "@google/genai";
import { Transaction, TransactionType } from './types';

if (!import.meta.env.VITE_GEMINI_API_KEY) {
  console.warn("VITE_GEMINI_API_KEY environment variable not set. Using a placeholder.");
}

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY! });

// ============ CACHE SIMPLES EM MEMÓRIA ============
interface CacheEntry {
  response: any;
  timestamp: number;
}

const geminiCache = new Map<string, CacheEntry>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hora em ms
const MAX_CACHE_SIZE = 50; // Máximo de entradas em cache

// Gera hash simples para comandos
function hashCommand(command: string): string {
  // Normaliza o comando (lowercase, remove espaços extras)
  const normalized = command.toLowerCase().trim().replace(/\s+/g, ' ');
  
  // Hash simples baseado em caracteres
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(36);
}

// Verifica similaridade básica entre comandos
function areSimilarCommands(cmd1: string, cmd2: string): boolean {
  const normalize = (s: string) => s.toLowerCase().trim().replace(/\s+/g, ' ');
  const n1 = normalize(cmd1);
  const n2 = normalize(cmd2);
  
  // Se são idênticos após normalização
  if (n1 === n2) return true;
  
  // Se diferença é menor que 10% do tamanho
  const maxLen = Math.max(n1.length, n2.length);
  const minLen = Math.min(n1.length, n2.length);
  if ((maxLen - minLen) / maxLen < 0.1) {
    // Conta caracteres diferentes
    let diffs = 0;
    for (let i = 0; i < minLen; i++) {
      if (n1[i] !== n2[i]) diffs++;
    }
    return (diffs / maxLen) < 0.15; // Menos de 15% de diferença
  }
  
  return false;
}

// Limpa cache antigo
function cleanCache() {
  const now = Date.now();
  const keysToDelete: string[] = [];
  
  geminiCache.forEach((entry, key) => {
    if (now - entry.timestamp > CACHE_TTL) {
      keysToDelete.push(key);
    }
  });
  
  keysToDelete.forEach(key => geminiCache.delete(key));
  
  // Se ainda está muito grande, remove os mais antigos
  if (geminiCache.size > MAX_CACHE_SIZE) {
    const entries = Array.from(geminiCache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    const toRemove = entries.slice(0, geminiCache.size - MAX_CACHE_SIZE);
    toRemove.forEach(([key]) => geminiCache.delete(key));
  }
}

// Busca no cache com tolerância a pequenas variações
function getCachedResponse(command: string): any | null {
  cleanCache();
  
  const hash = hashCommand(command);
  
  // Primeiro tenta match exato pelo hash
  if (geminiCache.has(hash)) {
    const entry = geminiCache.get(hash)!;
    if (Date.now() - entry.timestamp < CACHE_TTL) {
      console.log('🎯 Cache hit (exact) para comando Gemini');
      return entry.response;
    }
  }
  
  // Se não encontrou, tenta match por similaridade
  for (const [key, entry] of geminiCache.entries()) {
    if (Date.now() - entry.timestamp < CACHE_TTL) {
      // Armazenamos o comando original no response para comparação
      if (entry.response._originalCommand && areSimilarCommands(command, entry.response._originalCommand)) {
        console.log('🎯 Cache hit (similar) para comando Gemini');
        return entry.response;
      }
    }
  }
  
  return null;
}

function setCachedResponse(command: string, response: any) {
  const hash = hashCommand(command);
  // Armazena o comando original para comparação de similaridade
  const enrichedResponse = { ...response, _originalCommand: command };
  geminiCache.set(hash, { response: enrichedResponse, timestamp: Date.now() });
}

// ============ SCHEMA ============

const transactionSchema = {
  type: Type.OBJECT,
  properties: {
    date: { 
      type: Type.STRING, 
      description: "A data da transação no formato AAAA-MM-DD. Se o dia não for especificado, use o dia de hoje. Se o mês não for especificado, use o mês atual. Se o ano não for especificado, use o ano atual.",
    },
    type: { 
      type: Type.STRING, 
      enum: [TransactionType.ENTRADA, TransactionType.SAIDA],
      description: "O tipo de transação: 'Entrada' para recebimentos, 'Saida' para pagamentos.",
    },
    accountNumber: { 
      type: Type.INTEGER,
      description: "O número da conta do plano de contas.",
    },
    accountName: { 
      type: Type.STRING,
      description: "O nome da conta do plano de contas (ex: Pró-labore, Venda de bezerro).",
    },
    description: { 
      type: Type.STRING,
      description: "Um histórico ou descrição curta da transação.",
    },
    quantity: {
      type: Type.NUMBER,
      description: "A quantidade de itens na transação, se aplicável.",
    },
    unitValue: {
        type: Type.NUMBER,
        description: "O valor unitário de cada item na transação, se aplicável.",
    },
    amount: { 
      type: Type.NUMBER,
      description: "O valor total da transação. Se quantidade e valor unitário forem fornecidos, este deve ser o produto deles.",
    },
    payee: { 
      type: Type.STRING,
      description: "O nome do fornecedor (para saídas) ou comprador (para entradas).",
    },
    paymentMethod: { 
      type: Type.STRING,
      description: "A forma de pagamento (ex: pix, dinheiro, cartão).",
    },
  },
  required: ['date', 'type', 'accountNumber', 'accountName', 'amount', 'payee', 'description'],
};

// ============ THROTTLING ============

let lastCallTimestamp = 0;
const MIN_CALL_INTERVAL = 2000; // 2 segundos entre chamadas

async function throttledCall<T>(fn: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const timeSinceLastCall = now - lastCallTimestamp;
  
  if (timeSinceLastCall < MIN_CALL_INTERVAL) {
    await new Promise(resolve => setTimeout(resolve, MIN_CALL_INTERVAL - timeSinceLastCall));
  }
  
  lastCallTimestamp = Date.now();
  return fn();
}

// ============ SESSION LIMIT ============

let sessionCallCount = 0;
const MAX_CALLS_PER_SESSION = 20;

function canMakeCall(): boolean {
  return sessionCallCount < MAX_CALLS_PER_SESSION;
}

function incrementCallCount() {
  sessionCallCount++;
  console.log(`📊 Gemini API calls this session: ${sessionCallCount}/${MAX_CALLS_PER_SESSION}`);
}

// Reseta contador (chamar no login do usuário)
export function resetSessionCallCount() {
  sessionCallCount = 0;
}

// ============ API FUNCTIONS ============

export const parseTransactionFromText = async (command: string): Promise<Partial<Transaction> | null> => {
  // 1. Verifica cache primeiro
  const cached = getCachedResponse(command);
  if (cached) {
    const { _originalCommand, ...cleanResponse } = cached;
    return cleanResponse as Partial<Transaction>;
  }
  
  // 2. Verifica limite de sessão
  if (!canMakeCall()) {
    console.warn('⚠️ Limite de chamadas Gemini atingido nesta sessão');
    alert('Limite de comandos de voz atingido. Tente novamente mais tarde ou digite manualmente.');
    return null;
  }
  
  try {
    const response = await throttledCall(async () => {
      incrementCallCount();
      
      return ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `Analise o seguinte comando de voz e extraia as informações para um lançamento financeiro. Hoje é ${new Date().toLocaleDateString('pt-BR')}. Comando: "${command}"`,
        config: {
          responseMimeType: "application/json",
          responseSchema: transactionSchema,
        },
      });
    });

    const jsonText = response.text?.trim();
    if (!jsonText) return null;
    
    const parsedJson = JSON.parse(jsonText);
    
    // Salva no cache
    setCachedResponse(command, parsedJson);
    
    return parsedJson as Partial<Transaction>;
  } catch (error) {
    console.error("Error parsing transaction with Gemini:", error);
    return null;
  }
};

export const transcribeAudio = async (audioBase64: string, mimeType: string): Promise<string> => {
  // Para áudio, não usamos cache pois cada áudio é único
  
  if (!canMakeCall()) {
    console.warn('⚠️ Limite de chamadas Gemini atingido nesta sessão');
    alert('Limite de comandos de voz atingido. Tente novamente mais tarde.');
    return "";
  }
  
  try {
    const response = await throttledCall(async () => {
      incrementCallCount();
      
      return ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: {
          parts: [
            {
              inlineData: {
                data: audioBase64,
                mimeType: mimeType,
              },
            },
            {
              text: "Transcreva este áudio, que é um comando para um aplicativo financeiro. A transcrição deve ser concisa e direta.",
            },
          ],
        },
      });
    });

    return response.text || "";
  } catch (error) {
    console.error("Error transcribing audio:", error);
    return "";
  }
};

// ============ STATS ============

export function getGeminiStats() {
  return {
    sessionCalls: sessionCallCount,
    maxCalls: MAX_CALLS_PER_SESSION,
    cacheSize: geminiCache.size,
    maxCacheSize: MAX_CACHE_SIZE,
  };
}
