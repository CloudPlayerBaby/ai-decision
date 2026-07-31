import '../../styles/ChatMessage.css'

interface Props{
    content:string;
}

export function ChatMessage({content}:Props){
    return(
        <div className="chat-bubble--user">
            <div className="chat-bubble__content">
                {content}
            </div>
        </div>
    )
}