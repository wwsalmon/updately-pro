import {Dispatch, ReactNode, SetStateAction} from 'react';
import Modal from "react-modal";

export default function UpModal({isOpen, setIsOpen, children, wide = false}: {
    isOpen: boolean,
    setIsOpen: Dispatch<SetStateAction<boolean>>,
    children: ReactNode,
    wide?: boolean,
}) {
    const ModalClasses = "top-24 left-1/2 fixed bg-white p-4 rounded-md shadow-xl mx-4";

    return (
        <Modal
            isOpen={isOpen}
            onRequestClose={() => setIsOpen(false)}
            className={ModalClasses}
            style={{content: {transform: "translateX(calc(-50% - 16px))", maxWidth: "calc(100% - 32px)", width: wide ? 700 : 320}, overlay: {zIndex: 50}}}
        >
            {children}
        </Modal>
    );
}