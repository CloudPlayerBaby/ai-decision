import '../../styles/ChatMessage.css'

interface Props{
    content:string;
}

export function ChatMessage({content}:Props){
    return(
        <div className="chat-message user">
            <div className="bubble">
                {content}
            </div>
        </div>
    )
}