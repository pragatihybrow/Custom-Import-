frappe.ui.form.on("Material Request", {
    validate: function (frm) {
        if (frm.doc.material_request_type == "Purchase") {
            let promises = [];
            frm.doc.items.forEach(item => {
                let p = frappe.call({
                    method: "frappe.client.get_value",
                    args: {
                        doctype: "Item",
                        filters: {
                            name: item.item_code
                        },
                        fieldname: ["min_order_qty",]
                    }
                }).then(r => {
                    if (r.message && item.qty < r.message.min_order_qty) {
                        frappe.msgprint(`Item ${item.item_code} has qty less than minimum order quantity (${r.message.min_order_qty}).`);
                        frappe.validated = false;
                    }
                });
                // if (item.custom_plant != frm.doc.custom_plant) {
                //     frappe.msgprint(`Item ${item.item_code} The selected plant does not match the expected one. Please choose the correct plant. (${frm.doc.custom_plant}).`);
                //     frappe.validated = false;
                // }
                promises.push(p);
            });

            return Promise.all(promises);
        }
    },
    onload_post_render: function (frm) {
        if (!frm._custom_called_once && frm.doc.docstatus === 1) {
            console.log("onload_post_render called for Material Request");
            frm._custom_called_once = true;
            frappe.call({
                method: "import.config.py.material_request.get_purchase_order_details",
                args: {
                    doc: frm.doc
                },
                callback: function (r) {
                    if (!r.exc) {
                        frm.reload_doc();
                        frm.refresh_field("custom_tracking_status_for_mr");
                        frm.refresh_field("items");
                    }
                }
            });
        }
    }
})

frappe.ui.form.on("Material Request Item", {
    // item_code: function (frm, cdt, cdn) {
    //     let row = locals[cdt][cdn]
    //     row.custom_plant = frm.doc.custom_plant
    //     console.log(row.custom_plant)
    //     frm.refresh_field("items");
    // },
    form_render: function (frm, cdt, cdn) {
        tracking_status_of_mr(frm, cdt, cdn);
    }
})


function tracking_status_of_mr(frm, cdt, cdn) {
    let d = locals[cdt][cdn]

    let row = frm.fields_dict['items'].grid.grid_rows_by_docname[cdn];
    if (!row) return;

    let wrapper = row.grid_form.fields_dict['custom_track_status'];
    if (!wrapper) return;

    let html = `
        <style>
            .wide-table { width: 100%; }
            .text-right { text-align: right; }
        </style>

        <div class="container mt-3">
            <table class="table table-bordered table-hover wide-table" id="supplier-table">
                <thead class="thead-light">
                    <tr>
                        <th class="text-right">Purchase Order</th>
                        <th class="text-right">Purchase Order Qty</th>
                        <th class="text-right">GRN Qty</th>
                        <th class="text-right">Po Pending Qty</th>
                    </tr>
                </thead>
                <tbody>
                    <!-- Dynamic rows will be added here -->
                </tbody>
            </table>
        </div>
    `;
    $(wrapper.wrapper).html(html);

    displayStoredData(frm, d.name, d.item_code);

    // Function to display stored data from child table
    function displayStoredData(frm, item_row_name,) {
        frm.doc.custom_tracking_status_for_mr.forEach(function (data_row) {
            if (data_row.item_code === d.item_code) {
                let newRow = `
                    <tr>
                        <td><input type="text" class="form-control supplier-input" name="purchase_order" value="${data_row.purchase_order || ''}" readonly></td>
                        <td><input type="number" step="0.01" class="form-control text-right rate-input" name="purchase_order_qty" value="${data_row.purchase_order_qty || ''}" readonly></td>
                        <td><input type="number" step="0.01" class="form-control text-right qty-input" name="grn_qty" value="${data_row.grn_qty || ''}" readonly></td>
                        <td><input type="number" step="0.01" class="form-control text-right received-qty-input" name="po_pending_qty" value="${data_row.po_pending_qty || ''}" readonly></td>
                    </tr>
                `;

                $(wrapper.wrapper).find('#supplier-table tbody').append(newRow);
            }
        });

        frm.refresh_field('items');
    }


    frm.refresh_field('items');

}