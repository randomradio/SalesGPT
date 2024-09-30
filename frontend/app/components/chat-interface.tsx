'use client'
import React, { useState, useEffect, useRef, ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid'; // For generating unique session_id
import { Input } from "./ui/Input";
import styles from './ChatInterface.module.css';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import Image from 'next/image';
import Header from './ui/Header';
import Title from './ui/Title';
import { ChatMessage, ProChat } from "@ant-design/pro-chat";

import { PostHog } from 'posthog-node'
import { flushSync } from 'react-dom';

let client: PostHog | undefined;
if (process.env.NEXT_PUBLIC_ENVIRONMENT === "production") {
  client = new PostHog(
    `${process.env.NEXT_PUBLIC_POSTHOG_ID}`,
    {
      host: 'https://app.posthog.com',
      disableGeoip: false,
      requestTimeout: 30000
    }
  );
}

type Message = {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  thinkingProcess?: {
    conversationalStage: string,
    useTools: boolean,
    tool?: string,
    toolInput?: string,
    actionOutput?: string,
    actionInput?: string
  };
};


export function ChatInterface() {
  const searchParams = useSearchParams();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [session_id] = useState(uuidv4()); // Unique session_id generated when the component mounts
  const [stream, setStream] = useState(() => {
    const streamParam = searchParams.get('stream');
    return streamParam === 'true';
  });

  const [conversationalStage, setConversationalStage] = useState('');
  const [thinkingProcess, setThinkingProcess] = useState<{
    conversationalStage: string,
    tool?: string,
    toolInput?: string,
    actionOutput?: string,
    actionInput?: string
  }[]>([]);
  const [maxHeight, setMaxHeight] = useState(`calc(100vh - 64px)`); // Default to 100% of the viewport height
  const messagesEndRef = useRef<null | HTMLDivElement>(null);
  const thinkingProcessEndRef = useRef<null | HTMLDivElement>(null);
  const [botHasResponded, setBotHasResponded] = useState(false);
  const [showComponent, setShowComponent] = useState(false);
  useEffect(() => setShowComponent(true), []);
  const [chats, setChats] = useState<ChatMessage<Record<string, any>>[]>([]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    thinkingProcessEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thinkingProcess]);

  useEffect(() => {
    if (botHasResponded) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      thinkingProcessEndRef.current?.scrollIntoView({ behavior: "smooth" });
      setBotHasResponded(false); // Reset the flag
    }
  }, [botHasResponded]);

  useEffect(() => {
    // This function will be called on resize events
    const handleResize = () => {
      setMaxHeight(`${window.innerHeight - 64} px`);
    };

    // Set the initial value when the component mounts
    handleResize();

    // Add the event listener for future resize events
    window.addEventListener('resize', handleResize);

    // Return a cleanup function to remove the event listener when the component unmounts
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const sendMessage = (onMessageSend: (message: string) => void | Promise<any>) => {
    if (!inputValue.trim()) return;
    // const userMessage = `${inputValue}`;
    // const updatedMessages = [...messages, { id: uuidv4(), text: userMessage, sender: 'user' }];
    // setMessages(updatedMessages);
    onMessageSend(inputValue);
    setInputValue('');
  };

  useEffect(() => {
    console.log('NEXT_PUBLIC_AUTH_KEY:', process.env.NEXT_PUBLIC_AUTH_KEY);
    console.log('NEXT_PUBLIC_ENVIRONMENT:', process.env.NEXT_PUBLIC_ENVIRONMENT);
    console.log('NEXT_PUBLIC_API_URL:', process.env.NEXT_PUBLIC_API_URL);
  }, []);

  const fetchBotResponse = async (userMessage: string) => {
    const requestData = {
      session_id,
      human_say: userMessage,
      stream
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (process.env.NEXT_PUBLIC_ENVIRONMENT === "production") {
      headers['Authorization'] = `Bearer ${process.env.NEXT_PUBLIC_AUTH_KEY}`;
    }

    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/chat?stream=${stream}`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(requestData),
    });

    if (!response.ok) {
      throw new Error(`网络响应不正常: ${response.statusText}`);
    }

    return response;
  };

  const updateBotInfo = (data: any) => {
    setConversationalStage(data.conversation_stage);
    setThinkingProcess(prevProcess => [...prevProcess, {
      conversationalStage: data.conversation_stage,
      tool: data.tool,
      toolInput: data.tool_input,
      actionOutput: data.action_output,
      actionInput: data.action_input
    }]);
    // setBotName(data.bot_name);
  };

  // 创建可读流
  const createReadableStream = async (response: Response) => {
    // 获取 reader
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    const encoder = new TextEncoder();

    const readableStream = new ReadableStream({
      async start(controller) {
        function push() {
          reader
            .read()
            .then(({ done, value }) => {
              if (done) {
                controller.close();
                return;
              }
              const chunk = decoder.decode(value, { stream: true });

              const lines = chunk.split('\n');

              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  const data = line.slice(6); // Remove 'data: ' prefix

                  if (data === '[DONE]') {
                    break;
                  }

                  const parsedData = JSON.parse(data);

                  if (parsedData.token) {
                    controller.enqueue(encoder.encode(parsedData.token))
                  }

                  if (parsedData.conversation_stage) {
                    updateBotInfo(parsedData);
                  }
                }
              }
              push();
            })
            .catch((err) => {
              console.error('读取流中的数据时发生错误', err);
              controller.error(err);
            });
        }
        push();
      },
    });

    return readableStream;
  }

  // 输入区域渲染
  const inputAreaRender = (
    _: ReactNode,
    onMessageSend: (message: string) => void | Promise<any>,
    onClear: () => void,
  ) => {
    return (
      <div className="p-4">
        <Input
          className="w-full"
          placeholder="你想了解什么？"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              sendMessage(onMessageSend);
            }
          }}
        />
      </div>
    );
  };

  // 获取消息
  const getMessage = (_messages: ChatMessage[]) => {
    let historyMessages = _messages.length
      ? _messages.slice(-5, -1)
      : [];
    if (historyMessages.length) {
      historyMessages = historyMessages.filter(
        (item) => item.content !== ""
      );
    }
    const curMessage = _messages.slice(-1)[0];

    return curMessage.content
  }

  const handleRequest = async (_messages: ChatMessage[]) => {
    setMessages(_messages);
    const message = getMessage(_messages);
    if (!message.trim()) return;
    const response = await fetchBotResponse(message);

    if (!response.ok) {
      throw new Error(`网络响应不正常: ${response.statusText}`);
    }

    if (stream) {
      const readableStream = await createReadableStream(response);
      return new Response(readableStream);
    } else {
      const res = await response.text();

      const parsedData = JSON.parse(res)
      parsedData.conversation_stage = parsedData.conversational_stage

      if (parsedData.conversation_stage) {
        updateBotInfo(parsedData);
      }

      return new Response(parsedData.response);
    }
  };

  const renderChatContent = (props: any, defaultDoms: ReactNode) => {
    const assistantMessages = chats.filter(item => item.role === 'assistant')
    const index = assistantMessages.findIndex(item => item.id === props['data-id'])
    return (
      <div className='flex justify-between w-full'>
        {defaultDoms}
        {
          index > -1 && (
            <div className="flex items-center justify-end ml-2">
              <div className="text-sm text-gray-500" style={{ minWidth: '20px', textAlign: 'right' }}>
                <strong>({index + 1})</strong>
              </div>
            </div>
          )
        }
      </div>
    )
  }

  return (
    <div key="1" className="flex flex-col " style={{ height: '100vh' }}>
      <Header />
      <main className="flex flex-row justify-center items-start bg-[#F5F5F5] p-6 flex-grow overflow-hidden text-[14px]" >
        <div className="flex flex-col w-1/2 h-full bg-white rounded-lg shadow-[0px_0px_0px_1px_#FFFFFF] mr-4 chat-messages">
          <Title title="产品销售" />
          {
            showComponent && (
              <ProChat
                chats={chats}
                onChatsChange={(chats) => {
                  setChats(chats);
                }}
                userMeta={{
                  avatar: '/user.png'
                }}
                assistantMeta={{
                  avatar: '/maskot.png'
                }}
                request={handleRequest}
                inputAreaRender={inputAreaRender}
                chatItemRenderConfig={{
                  actionsRender: false,
                  contentRender: renderChatContent
                }}
                className={styles.hideScrollbar}
              />
            )
          }
        </div>
        <div className="flex flex-col w-1/2 h-full bg-white rounded-lg shadow-[0px_0px_0px_1px_#FFFFFF] thinking-process">
          <Title title="营销流程助手" />
          <div className={`flex-1 overflow-y-auto hide-scroll px-4 ${styles.hideScrollbar}`} style={{ overflowX: 'hidden' }}>
            <div>
              {thinkingProcess.map((process, index) => (
                <div key={index} className="break-words my-2">
                  <div><strong>({index + 1})</strong></div>
                  <div><strong>销售阶段:</strong> {process.conversationalStage}</div>
                  {process.tool && (
                    <div><strong>Tool:</strong> {process.tool}</div>
                  )}
                  {process.toolInput && (
                    <div><strong>Tool Input:</strong> {process.toolInput}</div>
                  )}
                  {process.actionInput && (
                    <div><strong>Action Input:</strong> {process.actionInput}</div>
                  )}
                  {process.actionOutput && (
                    <div><strong>Action Output:</strong> {process.actionOutput}</div>
                  )}
                </div>
              ))}
            </div>
            <div ref={thinkingProcessEndRef} />
          </div></div>
      </main >
    </div >
  );
}