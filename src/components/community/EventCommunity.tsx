import { Camera, Check, Heart, MessageCircle, Send, ShieldCheck, X } from 'lucide-react'
import { useState } from 'react'
import { Event } from '../../lib/api'
import { Language, ListenButton } from '../accessibility/ListenButton'

const photos = [
  ['Sarah', 'I had lots of fun painting!', 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=700&q=80', 6],
  ['James', 'The walk was calm and friendly.', 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=700&q=80', 4],
  ['Alex', 'I liked meeting Jordan at the door.', 'https://images.unsplash.com/photo-1524368535928-5b5e00ddc76b?auto=format&fit=crop&w=700&q=80', 3],
  ['Mina', 'We made colourful art together.', 'https://images.unsplash.com/photo-1452802447250-d2cb1bc26d1e?auto=format&fit=crop&w=700&q=80', 8],
] as const

export function EventCommunity({ event, slow, language }: { event: Event; slow: boolean; language: Language }) {
  const [tab, setTab] = useState<'Updates' | 'Chat' | 'Photos' | 'Going'>('Updates')
  const [message, setMessage] = useState('')
  const [messages, setMessages] = useState([{ name: 'Jordan', text: 'See everyone Saturday! We will have snacks.', time: '10:10 AM', mine: false }, { name: 'You', text: 'Can I bring my support person?', time: '10:12 AM', mine: true }, { name: 'Jordan', text: 'Yes. Support people are welcome.', time: '10:13 AM', mine: false }])
  const [memory, setMemory] = useState(false)
  const send = () => { if (message.trim()) { setMessages((all) => [...all, { name: 'You', text: message.trim(), time: 'Now', mine: true }]); setMessage('') } }
  return <section className="community-plus"><div className="circle-heading"><div><p className="eyebrow">EVENT CIRCLE</p><h1>{event.title}</h1><p>Only people in this event can see this space.</p></div><span className="private-badge"><ShieldCheck size={17} />Private by default</span></div><div className="circle-tabs">{(['Updates', 'Chat', 'Photos', 'Going'] as const).map((item) => <button key={item} className={tab === item ? 'active' : ''} onClick={() => setTab(item)} aria-label={item}>{item === 'Updates' ? '📢' : item === 'Chat' ? '💬' : item === 'Photos' ? '📷' : '👥'}<span>{item}</span></button>)}</div>
    {tab === 'Updates' && <div className="update-list">{[['Today · 9:10 AM', 'Today’s event is in Room 2.'], ['Yesterday · 4:30 PM', 'The quiet room is next door.'], ['Friday · 11:00 AM', 'Support people are welcome.']].map(([time, text]) => <article key={text}><span>J</span><div><strong>Jordan · host</strong><small>{time}</small><p>{text}</p></div><ListenButton text={text} label="host update" slow={slow} language={language} /></article>)}</div>}
    {tab === 'Chat' && <div className="chat-plus"><p className="moderated"><ShieldCheck size={16} />Host-moderated chat</p>{messages.map((item, index) => <div key={index} className={'bubble ' + (item.mine ? 'mine' : '')}><strong>{item.name}</strong><p>{item.text}</p><small>{item.time}</small><ListenButton text={item.text} label="chat message" slow={slow} language={language} /></div>)}<div className="chat-input"><input value={message} onChange={(event) => setMessage(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && send()} aria-label="Write a message" placeholder="Write a message" maxLength={120} /><button onClick={send} aria-label="Send message"><Send size={19} />Send</button></div></div>}
    {tab === 'Photos' && <><div className="photo-feed">{photos.map(([name, caption, image, likes]) => <article key={name}><header><span>{name[0]}</span><strong>{name}</strong><small>Previous event</small></header><img src={image} alt={'Consent-approved photo from ' + name} /><p>{caption}</p><footer><button aria-label={'Like ' + name}><Heart size={17} />{likes}</button><button aria-label={'Reply to ' + name}><MessageCircle size={17} />Reply</button></footer></article>)}</div><button className="memory-button" onClick={() => setMemory(true)} aria-label="Add a memory"><Camera size={20} />Add a memory</button>{memory && <div className="memory-modal" role="dialog" aria-modal="true"><button className="modal-close" onClick={() => setMemory(false)} aria-label="Close add memory"><X /></button><h2>Add a memory</h2><button className="upload-box" aria-label="Add photo placeholder">📷<br />Add a photo</button><input maxLength={80} placeholder="One short sentence" aria-label="Memory caption" /><button className="post-memory" onClick={() => setMemory(false)}>Post</button></div>}</>}
    {tab === 'Going' && <div className="going circle-panel"><h2>8 people are going</h2><p>Your name stays hidden unless you choose to share it.</p><button>Join privately <Check size={18} /></button></div>}
  </section>
}
