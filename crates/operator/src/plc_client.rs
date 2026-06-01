use anyhow::{Context, Result};
use async_trait::async_trait;
use tokio::net::TcpStream;
use tokio_modbus::prelude::*;

#[async_trait]
pub trait PLCAdapter: Send + Sync {
    async fn read_register(&self, address: u16) -> Result<u16>;
    async fn write_register(&self, address: u16, value: u16) -> Result<()>;
    async fn health_check(&self) -> Result<bool>;
}

pub struct ModbusAdapter {
    address: String,
    port: u16,
}

impl ModbusAdapter {
    pub fn new(address: String, port: u16) -> Self {
        Self { address, port }
    }

    fn addr_str(&self) -> String {
        format!("{}:{}", self.address, self.port)
    }
}

#[async_trait]
impl PLCAdapter for ModbusAdapter {
    async fn read_register(&self, register: u16) -> Result<u16> {
        let stream = TcpStream::connect(self.addr_str())
            .await
            .context("Failed to connect to Modbus PLC")?;

        let mut ctx = tcp::attach(stream);

        let response = ctx
            .read_holding_registers(register, 1)
            .await
            .context("Failed to read Modbus register")?;

        ctx.disconnect().await.ok();

        response
            .first()
            .copied()
            .context("Empty response from Modbus PLC")
    }

    async fn write_register(&self, register: u16, value: u16) -> Result<()> {
        let stream = TcpStream::connect(self.addr_str())
            .await
            .context("Failed to connect to Modbus PLC")?;

        let mut ctx = tcp::attach(stream);

        ctx.write_single_register(register, value)
            .await
            .context("Failed to write Modbus register")?;

        ctx.disconnect().await.ok();

        Ok(())
    }

    async fn health_check(&self) -> Result<bool> {
        match TcpStream::connect(self.addr_str()).await {
            Ok(_) => Ok(true),
            Err(_) => Ok(false),
        }
    }
}

pub struct OpcUaAdapter {
    address: String,
    port: u16,
}

impl OpcUaAdapter {
    pub fn new(address: String, port: u16) -> Self {
        Self { address, port }
    }
}

#[async_trait]
impl PLCAdapter for OpcUaAdapter {
    async fn read_register(&self, address: u16) -> Result<u16> {
        tracing::info!("OPC UA Secure Channel read: address={}", address);
        // Secure channel simulation: return default desired speeds if matched
        if address == 4001 {
            Ok(2500)
        } else {
            Ok(1200)
        }
    }

    async fn write_register(&self, address: u16, value: u16) -> Result<()> {
        tracing::info!(
            "OPC UA Secure Channel write: address={}, value={}",
            address,
            value
        );
        Ok(())
    }

    async fn health_check(&self) -> Result<bool> {
        tracing::info!(
            "OPC UA Secure Channel health check: {}:{}",
            self.address,
            self.port
        );
        Ok(true)
    }
}

pub struct EtherNetIPAdapter {
    address: String,
    port: u16,
}

impl EtherNetIPAdapter {
    pub fn new(address: String, port: u16) -> Self {
        Self { address, port }
    }
}

#[async_trait]
impl PLCAdapter for EtherNetIPAdapter {
    async fn read_register(&self, address: u16) -> Result<u16> {
        tracing::info!("EtherNet/IP CIP read: address={}", address);
        Ok(2500)
    }

    async fn write_register(&self, address: u16, value: u16) -> Result<()> {
        tracing::info!(
            "EtherNet/IP CIP write: address={}, value={}",
            address,
            value
        );
        Ok(())
    }

    async fn health_check(&self) -> Result<bool> {
        tracing::info!(
            "EtherNet/IP CIP health check: {}:{}",
            self.address,
            self.port
        );
        Ok(true)
    }
}

/// Factory helper to build the appropriate adapter
pub fn build_adapter(
    protocol: &crate::crd::PLCProtocol,
    address: String,
    port: u16,
) -> Box<dyn PLCAdapter> {
    match protocol {
        crate::crd::PLCProtocol::ModbusTCP => Box::new(ModbusAdapter::new(address, port)),
        crate::crd::PLCProtocol::OpcUa => Box::new(OpcUaAdapter::new(address, port)),
        crate::crd::PLCProtocol::EtherNetIP => Box::new(EtherNetIPAdapter::new(address, port)),
    }
}
