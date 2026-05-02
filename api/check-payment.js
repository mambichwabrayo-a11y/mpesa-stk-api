function checkPaymentStatus(ref, amount){
    var payBtn=document.getElementById('payBtn');
    var attempts=0;

    checkInterval=setInterval(function(){
        attempts++;
        
        fetch(CHECK_PAYMENT_URL+'?ref='+ref+'&t='+Date.now())
  .then(res=>res.json())
  .then(data=>{
            
            // 1. SUCCESS - HII USIBADILISHE IKO PERFECT
            if(data.payment_status==='paid' || data.payment_status==='Success' || data.payment_status==='success'){
                clearInterval(checkInterval);
                showSuccessModal(data.mpesa_receipt, data.amount || amount);
                payBtn.disabled=false;
                payBtn.innerHTML='Pay with M-Pesa';
                document.getElementById('amount').value='';
                document.getElementById('phone').value='';
            }
            // 2. CANCELLED - FIX YA CANCEL
            else if(data.payment_status==='cancelled' || data.payment_status==='Cancelled'){
                clearInterval(checkInterval);
                showFailedModal('Request Cancelled by User. Please try again.');
                payBtn.disabled=false;
                payBtn.innerHTML='Pay with M-Pesa';
            }
            // 3. FAILED - KAMA PIN MBAYA
            else if(data.payment_status==='failed' || data.payment_status==='Failed'){
                clearInterval(checkInterval);
                showFailedModal(data.failure_reason || 'Payment Failed. Check your balance or PIN and try again.');
                payBtn.disabled=false;
                payBtn.innerHTML='Pay with M-Pesa';
            }
            // 4. TIMEOUT - MPYA HII
            else if(attempts>=30){
                clearInterval(checkInterval);
                showFailedModal('Request Timeout. You did not respond to the M-Pesa prompt within 90 seconds.');
                payBtn.disabled=false;
                payBtn.innerHTML='Pay with M-Pesa';
            }
        })
  .catch(function(err){
            if(attempts>=30){
                clearInterval(checkInterval);
                showFailedModal('Network Error. Please check your connection and try again.');
                payBtn.disabled=false;
                payBtn.innerHTML='Pay with M-Pesa';
            }
        })
    },3000)
}
