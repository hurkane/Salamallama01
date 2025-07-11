import React from "react";

function Modal({ isOpen, onClose, children }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50">
      <div className="relative">
        <button
          onClick={onClose}
          className="absolute top-0 right-0 text-white text-xl p-2"
        >
          ✖
        </button>
        {children}
      </div>
    </div>
  );
}

export default Modal;
