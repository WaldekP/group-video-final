import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import Peer from "simple-peer";
import styled from "styled-components";
import {Logo} from "../components/common/icons/logo";
import {CameraIcon} from "../components/common/icons/cameraIcon";
import {MicrofonIcon} from "../components/common/icons/microfonIcon";
import {EndCallIcon} from "../components/common/icons/endCallIcon";
import {ShareScreenIcon} from "../components/common/icons/shareScreenIcon";

const Container = styled.div`
    background: #0F1C49;
    height: 100vh;
    overflow: hidden;
`;

const VideoContainer = styled.div`
    display: flex;
    height: 100%;
    width: 100%;
    flex-wrap: wrap;
`;

const VideoBoxContainer = styled.div`
    padding: 20px;
    height: 75%;
    width: 75%;
    background: white;
    border-radius: 8px;
    margin: 50px auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
`;

const Nav = styled.nav`
    background: white;
    width: 100%;
    height: 100px;
    display: flex;
    justify-content: center;
    align-items: center;
`

const StyledVideo = styled.video`
    height: 40%;
    width: 50%;
`;

const ButtonsContainer = styled.div`
    display: flex;
    width: 100%;
    justify-content: space-between;
    svg {
        cursor: pointer;
    }
`;

const Video = (props) => {
    const ref = useRef();

    useEffect(() => {
        props.peer.on("stream", stream => {
            ref.current.srcObject = stream;
        })
    }, []);

    return (
        <StyledVideo playsInline autoPlay ref={ref} />
    );
}


const videoConstraints = {
    height: window.innerHeight / 2,
    width: window.innerWidth / 2
};

const Room = (props) => {
    const [isScreenShareOn, setIsScreenOn] = useState(false)
    const [callOn, setIsCallOn] = useState(false)
    const [peers, setPeers] = useState([]);
    const socketRef = useRef();
    const userVideo = useRef();
    const peersRef = useRef([]);
    const senders = useRef([]);
    const userStream = useRef();
    const [stream, setStream] = useState();
    const roomID = props.match.params.roomID;

    useEffect(() => {
        socketRef.current = io.connect("/");
        navigator.mediaDevices.getUserMedia({ video: videoConstraints, audio: true }).then(stream => {
            setIsCallOn(true);
            userVideo.current.srcObject = stream;
            userVideo.current.muted = true
            socketRef.current.emit("join room", roomID);
            socketRef.current.on("all users", users => {
                console.log('users', users)
                const peers = [];
                users.forEach(userID => {
                    const peer = createPeer(userID, socketRef.current.id, stream);
                    peersRef.current.push({
                        peerID: userID,
                        peer,
                    })
                    peers.push({
                        peerID: userID,
                        peer
                    });
                })
                setPeers(peers);
            })

            socketRef.current.on("user joined", payload => {
                const peer = addPeer(payload.signal, payload.callerID, stream);
                peersRef.current.push({
                    peerID: payload.callerID,
                    peer,
                })

                const peerObj = {
                    peer,
                    peerID: payload.callerID,
                }

                setPeers(users => [...users, peerObj]);
            });

            socketRef.current.on("receiving returned signal", payload => {
                const item = peersRef.current.find(p => p.peerID === payload.id);
                item.peer.signal(payload.signal);
            });
            socketRef.current.on("user left", id => {
                const peerObj = peersRef.current.find(p => p.peerID === id);
                if (peerObj) {
                    peerObj.peer.destroy()
                }
                const peers = peersRef.current.filter(p => p.peerID !== id)
                peersRef.current = peers
                setPeers(peers)
            })
        })
    }, []);

    function createPeer(userToSignal, callerID, stream) {
        setStream(stream)
        const peer = new Peer({
            initiator: true,
            trickle: false,
            stream,
        });

        peer.on("signal", signal => {
            socketRef.current.emit("sending signal", { userToSignal, callerID, signal })
        })

        return peer;
    }

    function addPeer(incomingSignal, callerID, stream) {
        setStream(stream)
        const peer = new Peer({
            initiator: false,
            trickle: false,
            stream,
        })

        peer.on("signal", signal => {
            socketRef.current.emit("returning signal", { signal, callerID })
        })

        // peer.on('stream', function (stream) {
        //     // got remote video stream, now let's show it in a video tag
        //     peer.srcObject = stream;
        //     // video.play();
        // })

        peer.signal(incomingSignal);

        return peer;
    }

    function toggleVid() {
        for (let index in userVideo.current.srcObject.getVideoTracks()) {
            userVideo.current.srcObject.getVideoTracks()[index].enabled = !userVideo.current.srcObject.getVideoTracks()[index].enabled
        }
        console.log('socketRef', socketRef)
        // peers[0].destroy()
    }

    function shareScreen(){
        setIsScreenOn(true)
        navigator.mediaDevices.getDisplayMedia({cursor:true})
            .then(screenStream=>{
                for (const item of peersRef.current) {
                    item.peer.replaceTrack(stream.getVideoTracks()[0],screenStream.getVideoTracks()[0],stream)
                }
                userVideo.current.srcObject=screenStream
                screenStream.getTracks()[0].onended = () =>{
                    for (const item of peersRef.current) {
                        item.peer.replaceTrack(stream.getVideoTracks()[0],screenStream.getVideoTracks()[0],stream)
                    }
                    userVideo.current.srcObject=stream
                }
            })
    }

    function stopScreenShare(){
        setIsScreenOn(false)
        navigator.mediaDevices.getUserMedia({ video: videoConstraints, audio: true })
            .then(screenStream=>{
                for (const item of peersRef.current) {
                    item.peer.replaceTrack(stream.getVideoTracks()[0],screenStream.getVideoTracks()[0],stream)
                }
                userVideo.current.srcObject=screenStream
                screenStream.getTracks()[0].onended = () =>{
                    for (const item of peersRef.current) {
                        item.peer.replaceTrack(stream.getVideoTracks()[0],screenStream.getVideoTracks()[0],stream)
                    }
                    userVideo.current.srcObject=stream
                }
            })
    }
    if (!callOn) {
        return <div>
            To jest koniec rozmowy. Czy chcesz sie jeszcze polaczyc?
        </div>
    }
    return (
        <>
            <Container>
                <Nav><Logo/></Nav>
                <VideoBoxContainer>
                    <VideoContainer>
                        <StyledVideo muted ref={userVideo} autoPlay playsInline />
                        {peers.map((peer, index) => {
                            return (
                                <Video key={peer.peerID} peer={peer.peer} />
                            );
                        })}
                    </VideoContainer>
                    <ButtonsContainer>
                        <div>
                            <span onClick={toggleVid} >
                                <CameraIcon />
                            </span>
                            <span>
                                <MicrofonIcon />
                            </span>
                        </div>
                        <span onClick={() => setIsCallOn(false)}>
                            <EndCallIcon />
                        </span>
                        <span onClick={isScreenShareOn ? stopScreenShare : shareScreen}>
                            <ShareScreenIcon onClick={shareScreen} />
                        </span>
                    </ButtonsContainer>
                </VideoBoxContainer>
            </Container>
        </>
    );
};

export default Room;
