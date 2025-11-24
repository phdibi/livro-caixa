
import React, { useState, useRef } from 'react';
import { MicrophoneIcon, SendIcon, SparklesIcon, StopIcon } from './Icons';
import { Transaction, Account } from './types';
import { parseTransactionFromText, transcribeAudio } from './geminiService';

interface GeminiAssistantProps {
    onTransactionParsed: (transaction: Partial<Transaction>) => void;
    accounts: Account[];
}

const fileToBase64 = (file: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(',')[1]);
        };
        reader.onerror = (error) => reject(error);
    });


export const GeminiAssistant: React.FC<GeminiAssistantProps> = ({ onTransactionParsed, accounts }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const [isRecording, setIsRecording] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    const handleToggle = () => setIsOpen(!isOpen);

    const handleMicClick = async () => {
        if (isRecording) {
            mediaRecorderRef.current?.stop();
            setIsRecording(false);
        } else {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                mediaRecorderRef.current = new MediaRecorder(stream);
                mediaRecorderRef.current.ondataavailable = (event) => {
                    audioChunksRef.current.push(event.data);
                };
                mediaRecorderRef.current.onstop = async () => {
                    setIsLoading(true);
                    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                    const audioBase64 = await fileToBase64(audioBlob);
                    
                    const transcribedText = await transcribeAudio(audioBase64, 'audio/webm');
                    if (transcribedText) {
                        setInputValue(transcribedText);
                        await processCommand(transcribedText);
                    }
                    audioChunksRef.current = [];
                    setIsLoading(false);
                    stream.getTracks().forEach(track => track.stop());
                };
                mediaRecorderRef.current.start();
                setIsRecording(true);
            } catch (err) {
                console.error("Error accessing microphone:", err);
                alert("Não foi possível acessar o microfone. Verifique as permissões do seu navegador.");
            }
        }
    };
    
    const processCommand = async (command: string) => {
        if (!command.trim()) return;

        setIsLoading(true);
        const parsedData = await parseTransactionFromText(command);
        if (parsedData) {
            onTransactionParsed(parsedData);
            setInputValue('');
            setIsOpen(false); 
        } else {
            alert('Não foi possível entender o comando. Tente novamente.');
        }
        setIsLoading(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await processCommand(inputValue);
    };

    return (
        <>
            <button
                onClick={handleToggle}
                className="fixed bottom-6 right-6 bg-indigo-600 text-white p-4 rounded-full shadow-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 z-50 transition-transform transform hover:scale-110"
                aria-label="Assistente IA"
            >
                <SparklesIcon className="w-8 h-8" />
            </button>

            {isOpen && (
                <div className="fixed bottom-24 right-6 w-full max-w-sm bg-white dark:bg-gray-800 rounded-lg shadow-2xl z-50 border border-gray-200 dark:border-gray-700">
                    <div className="p-4 border-b dark:border-gray-700">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Assistente IA</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Descreva o lançamento ou grave um áudio.</p>
                    </div>
                    <div className="p-4">
                        <form onSubmit={handleSubmit} className="flex items-center space-x-2">
                            <input
                                type="text"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                placeholder={isRecording ? "Gravando..." : "Ex: saída R$50 almoço..."}
                                className="flex-1 p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-indigo-500"
                                disabled={isRecording || isLoading}
                            />
                            <button
                                type="button"
                                onClick={handleMicClick}
                                className={`p-3 rounded-full transition-colors ${isRecording ? 'bg-red-500 text-white' : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-300'}`}
                                disabled={isLoading}
                            >
                                {isRecording ? <StopIcon className="w-5 h-5" /> : <MicrophoneIcon className="w-5 h-5" />}
                            </button>
                            <button type="submit" className="p-3 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 disabled:bg-indigo-400" disabled={isRecording || isLoading}>
                                <SendIcon className="w-5 h-5" />
                            </button>
                        </form>
                        {isLoading && <p className="text-center mt-2 text-sm text-gray-500 dark:text-gray-400 animate-pulse">Processando...</p>}
                    </div>
                </div>
            )}
        </>
    );
};
