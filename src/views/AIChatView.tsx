import React, { useState } from 'react';
import { Bot, Loader2, Send, MessageSquarePlus, MoreVertical, Plus, X, Trash2, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAppContext } from '../AppContext';
import { getAIResponse } from '../services/aiService';
import { ChatMessage, ChatConversation } from '../types/chat';

const AIChatView = () => {
  const {
    config, aiConversations, setAiConversations,
    activeAiConvId, setActiveAiConvId,
    showAiConvList, setShowAiConvList,
    aiLoading, setAiLoading,
  } = useAppContext();

  const activeConv = aiConversations.find(c => c.id === activeAiConvId);
  const messages = activeConv?.messages || [];

  const handleNewConversation = () => {
    const newConv: ChatConversation = {
      id: `conv_${Date.now()}`,
      title: '新对话',
      messages: [],
      createdAt: Date.now(),
    };
    setAiConversations((prev: ChatConversation[]) => [newConv, ...prev]);
    setActiveAiConvId(newConv.id);
    setShowAiConvList(false);
  };

  const handleDeleteConversation = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = aiConversations.filter(c => c.id !== id);
    setAiConversations(updated);
    if (activeAiConvId === id) {
      setActiveAiConvId(updated.length > 0 ? updated[0].id : null);
    }
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const input = (document.getElementById('aiIn') as HTMLInputElement).value.trim();
    if (!input || aiLoading) return;

    let convId = activeAiConvId;
    if (!convId) {
      const newConv: ChatConversation = {
        id: `conv_${Date.now()}`,
        title: input.slice(0, 20) + (input.length > 20 ? '...' : ''),
        messages: [],
        createdAt: Date.now(),
      };
      setAiConversations((prev: ChatConversation[]) => [newConv, ...prev]);
      setActiveAiConvId(newConv.id);
      convId = newConv.id;
    }

    const userMsg: ChatMessage = { role: 'user', content: input };
    setAiConversations((prev: ChatConversation[]) => prev.map(c =>
      c.id === convId ? { ...c, messages: [...c.messages, userMsg], title: c.messages.length === 0 ? input.slice(0, 20) + (input.length > 20 ? '...' : '') : c.title } : c
    ));
    (document.getElementById('aiIn') as HTMLInputElement).value = '';
    setAiLoading(true);

    try {
      const conv = aiConversations.find(c => c.id === convId);
      const historyForApi = (conv?.messages || []).map(m => ({ role: m.role, content: m.content }));
      const response = await getAIResponse(input, config, historyForApi);
      const aiMsg: ChatMessage = { role: 'assistant', content: response || 'AI 未能生成回复' };
      setAiConversations((prev: ChatConversation[]) => prev.map(c =>
        c.id === convId ? { ...c, messages: [...c.messages, aiMsg] } : c
      ));
    } catch (error: any) {
      const errMsg: ChatMessage = { role: 'assistant', content: `❌ 错误: ${error.message}` };
      setAiConversations((prev: ChatConversation[]) => prev.map(c =>
        c.id === convId ? { ...c, messages: [...c.messages, errMsg] } : c
      ));
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="flex flex-col" style={{ height: 'calc(100dvh - 56px)' }}>
      {/* AI 页面头部 */}
      <div className="flex items-center justify-between px-1 pb-3">
        <div className="text-[10px] font-bold tracking-widest uppercase" style={{ color: 'var(--color-text-muted)' }}>
          {config.apiKey ? `${config.provider}` : '未配置 API'}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleNewConversation}
            className="p-2 rounded-xl text-slate-400 hover:bg-slate-100/60 hover:text-brand-500 transition-all"
            title="新建对话"
          >
            <MessageSquarePlus size={18} />
          </button>
          <button
            onClick={() => setShowAiConvList(true)}
            className="p-2 rounded-xl text-slate-400 hover:bg-slate-100/60 hover:text-brand-500 transition-all"
            title="对话记录"
          >
            <MoreVertical size={18} />
          </button>
        </div>
      </div>

      {/* 消息区域 */}
      <div className="flex-1 overflow-y-auto space-y-3 pb-4 px-1 no-scrollbar" id="aiMsgs">
        {messages.length === 0 && (
          <div className="text-center pt-20 space-y-4">
            <div className="w-16 h-16 bg-brand-50 rounded-2xl flex items-center justify-center mx-auto text-brand-500 shadow-glow-sm">
              <Bot size={28} />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-700 mb-1">AI 投资助手</div>
              <div className="text-xs text-slate-400 max-w-[240px] mx-auto">问我关于行业趋势或公司估值的问题</div>
            </div>
            <div className="flex flex-wrap justify-center gap-2 pt-2 px-4">
              {['分析白酒行业估值', '宁德时代值得投资吗', '什么是安全边际'].map(q => (
                <button
                  key={q}
                  onClick={() => {
                    (document.getElementById('aiIn') as HTMLInputElement).value = q;
                    handleSend();
                  }}
                  className="text-[11px] px-3 py-1.5 rounded-full bg-white border border-slate-200/60 text-slate-500 font-medium active:scale-95 transition-all hover:border-brand-300 hover:text-brand-600"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] px-4 py-2.5 text-[13px] leading-relaxed ${
              m.role === 'user' ? 'chat-bubble-user text-white' : 'chat-bubble-ai text-slate-700'
            }`}>
              {m.content}
            </div>
          </div>
        ))}
        {aiLoading && (
          <div className="flex justify-start">
            <div className="chat-bubble-ai px-4 py-2.5 text-slate-400 flex items-center gap-2 text-[13px]">
              <Loader2 size={15} className="animate-spin" /> 思考中...
            </div>
          </div>
        )}
      </div>

      {/* 输入栏 */}
      <form onSubmit={handleSend} className="flex gap-2 mt-2">
        <input
          id="aiIn"
          className="input-field flex-1 rounded-2xl py-3"
          placeholder="问问 AI..."
          disabled={aiLoading}
        />
        <button
          type="submit"
          disabled={aiLoading}
          className="btn-primary p-3 rounded-2xl disabled:opacity-40"
        >
          <Send size={18} />
        </button>
      </form>

      {/* 对话记录弹窗 */}
      <AnimatePresence>
        {showAiConvList && (
          <div className="fixed inset-0 z-[100] flex items-end justify-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAiConvList(false)}
              className="absolute inset-0 modal-overlay"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="relative w-full max-w-lg modal-sheet p-5 pb-[calc(20px+env(safe-area-inset-bottom))]"
            >
              <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-5" />
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-extrabold text-slate-900">对话记录</h3>
                <div className="flex items-center gap-1">
                  <button
                    onClick={handleNewConversation}
                    className="btn-primary px-3 py-1.5 rounded-lg text-xs flex items-center gap-1"
                  >
                    <Plus size={14} /> 新建
                  </button>
                  <button
                    onClick={() => setShowAiConvList(false)}
                    className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 transition-all"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>
              <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                {aiConversations.length === 0 && (
                  <div className="text-center py-12 text-slate-400 text-sm">
                    暂无对话记录
                  </div>
                )}
                {aiConversations.map(conv => (
                  <div
                    key={conv.id}
                    onClick={() => {
                      setActiveAiConvId(conv.id);
                      setShowAiConvList(false);
                    }}
                    className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${
                      conv.id === activeAiConvId ? 'bg-brand-50 border border-brand-200' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      conv.id === activeAiConvId ? 'bg-brand-100 text-brand-600' : 'bg-slate-100 text-slate-400'
                    }`}>
                      <MessageSquare size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-bold text-slate-800 truncate">{conv.title}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {conv.messages.length} 条消息 · {new Date(conv.createdAt).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <button
                      onClick={(e) => handleDeleteConversation(conv.id, e)}
                      className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all flex-shrink-0"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AIChatView;
