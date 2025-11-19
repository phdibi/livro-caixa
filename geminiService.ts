
import { GoogleGenAI, Type } from "@google/genai";
import { Transaction, TransactionType } from '../types';

if (!process.env.API_KEY) {
  console.warn("API_KEY environment variable not set. Using a placeholder.");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

const transactionSchema = {
  type: Type.OBJECT,
  properties: {
    date: { 
      type: Type.STRING, 
      description: "A data da transação no formato AAAA-MM-DD. Se o dia не for especificado, use o dia de hoje. Se o mês não for especificado, use o mês atual. Se o ano não for especificado, use o ano atual.",
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


export const parseTransactionFromText = async (command: string): Promise<Partial<Transaction> | null> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Analise o seguinte comando de voz e extraia as informações para um lançamento financeiro. Hoje é ${new Date().toLocaleDateString('pt-BR')}. Comando: "${command}"`,
      config: {
        responseMimeType: "application/json",
        responseSchema: transactionSchema,
      },
    });

    const jsonText = response.text.trim();
    const parsedJson = JSON.parse(jsonText);
    return parsedJson as Partial<Transaction>;
  } catch (error) {
    console.error("Error parsing transaction with Gemini:", error);
    return null;
  }
};

export const transcribeAudio = async (audioBase64: string, mimeType: string): Promise<string> => {
    try {
        const response = await ai.models.generateContent({
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

        return response.text;
    } catch (error) {
        console.error("Error transcribing audio:", error);
        return "";
    }
};