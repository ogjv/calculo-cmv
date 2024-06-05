document.getElementById('cmvForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    // Obtendo os valores dos inputs
    const productCost = parseFloat(document.getElementById('productCost').value);
    const cardFee = parseFloat(document.getElementById('cardFee').value);
    const bagCost = parseFloat(document.getElementById('bagCost').value);
    
    // Validando os valores inseridos
    if (isNaN(productCost) || isNaN(cardFee) || isNaN(bagCost)) {
        alert('Por favor, insira valores válidos.');
        return;
    }

    // Calculando a taxa da máquina de cartão
    const cardFeeAmount = (cardFee / 100) * productCost;
    
    // Calculando o CMV total
    const totalCmv = productCost + cardFeeAmount + bagCost;
    
    // Exibindo o resultado
    document.getElementById('result').innerText = `O CMV total é: R$ ${totalCmv.toFixed(2)}`;
});
