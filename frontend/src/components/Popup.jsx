function Popup({ titulo, children, onClose }){

  return(

    <div className="popup-overlay">

      <div className="popup">

        <div className="popup-header">

          <h2>{titulo}</h2>

          <button
          className="popup-close"
          onClick={onClose}
          >
          ✖
          </button>

        </div>

        <div className="popup-content">
          {children}
        </div>

      </div>

    </div>

  )

}

export default Popup