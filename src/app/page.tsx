'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../app/lib/supabaseClient';
import axios from 'axios';

interface Message {
  id: string;
  content: string;
  parent_id: string | null;
  created_at: string;
  version: number;
  role: 'user' | 'assistant';
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [previousVersions, setPreviousVersions] = useState<Message[]>([]);
  const [followUps, setFollowUps] = useState<Message[]>([]);
  

  // Fetch messages from Supabase
  const fetchMessages = async () => {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching messages:', error.message);
    } else {
      setMessages(data || []);
    }
  };

  // Send or edit message
  // Send or edit message
const sendMessage = async () => {
  if (newMessage.trim()) {
    try {
      setLoading(true);
      let insertedMessage;
  
      if (editingMessage) {
        // Update existing message
        const { data, error } = await supabase
          .from('messages')
          .update({ content: newMessage, version: editingMessage.version + 1 })
          .eq('id', editingMessage.id)
          .select();
        
        if (error) {
          console.error('Error updating message:', error.message);
          setLoading(false);
          return;
        }
        insertedMessage = data?.[0];
      } else {
        // Insert new message
        const { data, error } = await supabase
          .from('messages')
          .insert([{ content: newMessage, parent_id: null, role: 'user', version: 1 }])
          .select();
        
        if (error) {
          console.error('Error inserting message:', error.message);
          setLoading(false);
          return;
        }
        insertedMessage = data?.[0];
      }

      // Insert the prompt (user's request) into the `prompts` table
      const { error: promptError } = await supabase
        .from('prompts')
        .insert([{ message_id: insertedMessage.id, content: newMessage }]);
      
      if (promptError) {
        console.error('Error inserting prompt:', promptError.message);
      }

      // Reset input and fetch AI response
      setNewMessage('');
      setEditingMessage(null);

      // Call OpenAI API for a response
      const response = await axios.post('/api/chatgpt', { message: newMessage });

      // Save AI's response in Supabase
      await supabase
        .from('messages')
        .insert([{ content: response.data.response, parent_id: insertedMessage.id, role: 'assistant', version: 1 }]);

      // Fetch all messages once after all inserts
      fetchMessages();
      setLoading(false);
    } catch (error) {
      console.error('Error during message sending process:', error);
      setLoading(false);
    }
  }
};

  // Load previous versions of a message
  // Load previous versions of a message, including associated prompts
const loadPreviousVersions = async (messageId: string) => {
  try {
    // Fetch previous versions from 'messages' table
    const { data: messagesData, error: messagesError } = await supabase
      .from('messages')
      .select('*')
      .eq('parent_id', messageId)
      .order('version', { ascending: true });

    if (messagesError) {
      console.error('Error fetching previous versions:', messagesError.message);
      return;
    }

    // Fetch all related prompts from the 'prompts' table for the message
    const { data: promptsData, error: promptsError } = await supabase
      .from('prompts')
      .select('*')
      .eq('message_id', messageId)
      .order('created_at', { ascending: true });

    if (promptsError) {
      console.error('Error fetching prompts:', promptsError.message);
      return;
    }

    // Combine messages and prompts into previousVersions state
    setPreviousVersions([
      ...(messagesData || []),  // Previous message versions
      ...(promptsData || [])    // Related prompts
    ]);
  } catch (error) {
    console.error('Error loading previous versions and prompts:', error);
  }
};


  // Load follow-up messages (branches)
  const loadFollowUps = async (messageId: string) => {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('parent_id', messageId);

    if (error) {
      console.error('Error fetching follow-up messages:', error.message);
    } else {
      setFollowUps(data || []);
    }
  };

  useEffect(() => {
    fetchMessages();
  }, []);

  return (
    <div className="p-4">
      <div className="mb-4">
        <h1 className="text-2xl font-bold">ChatGPT Clone with Branching</h1>
      </div>

      <div className="border p-4 rounded mb-4 h-96 overflow-y-scroll">
        {messages.map((message) => (
          <div key={message.id} className={`p-2 border-b ${message.role === 'assistant' ? 'bg-gray-100' : ''}`}>
            <p>{message.role === 'assistant' ? '🤖 AI: ' : '👤 You: '}{message.content}</p>

            {/* Edit Message */}
            {message.role === 'user' && (
              <button onClick={() => {
                setEditingMessage(message);
                setNewMessage(message.content);  // Prefill the input with the current message
              }} className="text-blue-500 mr-2">Edit</button>
            )}

            {/* View Previous Versions */}
            {message.version > 1 && (
              <button onClick={() => loadPreviousVersions(message.id)} className="text-blue-500 mr-2">View Previous Versions</button>
            )}

            {/* View Follow-ups */}
            <button onClick={() => loadFollowUps(message.id)} className="text-blue-500">View Follow-ups</button>
          </div>
        ))}
      </div>

      {/* Show Previous Versions */}
      {previousVersions.length > 0 && (
        <div className="border p-4 rounded mb-4">
          <h3 className="font-bold">Previous Versions:</h3>
          {previousVersions.map((version) => (
            <div key={version.id} className="p-2 border-b">
              <p>Version {version.version}: {version.content}</p>
            </div>
          ))}
        </div>
      )}

      {/* Show Follow-ups */}
      {followUps.length > 0 && (
        <div className="border p-4 rounded mb-4">
          <h3 className="font-bold">Follow-up Messages:</h3>
          {followUps.map((followUp) => (
            <div key={followUp.id} className="p-2 border-b">
              <p>{followUp.role === 'assistant' ? '🤖 AI: ' : '👤 You: '}{followUp.content}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          className="border p-2 flex-grow"
          placeholder="Type your message..."
          disabled={loading}
        />
        <button onClick={sendMessage} className="bg-blue-500 text-white p-2 ml-2" disabled={loading}>
          {loading ? 'Loading...' : editingMessage ? 'Update' : 'Send'}
        </button>
      </div>
    </div>
  );
}